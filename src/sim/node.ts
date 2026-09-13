import { Block, BlockHeader, headerHash, txRootOf } from "./block";
import { Hex } from "./crypto";
import { Network, NodeId } from "./network";
import { Receipt, State } from "./state";
import { Tx, verifyTx } from "./tx";

export type SimEvent =
  | { t: number; node: NodeId; type: "tx-received"; txHash: Hex; via: NodeId | "rpc"; accepted: boolean; reason?: string }
  | { t: number; node: NodeId; type: "block-proposed"; blockHash: Hex; number: number; txCount: number }
  | { t: number; node: NodeId; type: "block-received"; blockHash: Hex; number: number; via: NodeId; accepted: boolean; reason?: string };

export const MAX_TXS_PER_BLOCK = 8;

/** A full node: keeps its own copy of the chain, state, and mempool; talks to peers over the network. */
export class Node {
  chain: Block[] = [];
  state = new State();
  mempool = new Map<Hex, Tx>();
  peers: NodeId[] = [];
  online = true;
  private seenTx = new Set<Hex>();
  private seenBlock = new Set<Hex>();
  /** Receipts indexed by tx hash, from this node's view of the chain. */
  receipts = new Map<Hex, Receipt>();
  txIndex = new Map<Hex, Tx>();

  constructor(public id: NodeId, public name: string, public address: Hex, public validator: boolean) {}

  head(): Block {
    return this.chain[this.chain.length - 1];
  }

  init(genesis: Block, state: State) {
    this.chain = [genesis];
    this.state = state.clone();
    this.seenBlock.add(genesis.hash);
  }

  /** Called when a tx arrives, either from a wallet via RPC or gossiped from a peer. */
  receiveTx(tx: Tx, via: NodeId | "rpc", now: number, net: Network, log: SimEvent[]): { ok: boolean; reason?: string } {
    if (!this.online) return { ok: false, reason: "node offline" };
    if (this.seenTx.has(tx.hash)) return { ok: true, reason: "already seen" };
    this.seenTx.add(tx.hash);

    const v = verifyTx(tx);
    if (!v.ok) {
      log.push({ t: now, node: this.id, type: "tx-received", txHash: tx.hash, via, accepted: false, reason: v.reason });
      return { ok: false, reason: v.reason };
    }
    // Mempool admission: nonce must not be in the past, sender must afford gas. (Future nonces are allowed to queue.)
    const acct = this.state.get(tx.from);
    if (tx.nonce < acct.nonce) {
      const reason = `nonce too low (${tx.nonce} < ${acct.nonce})`;
      log.push({ t: now, node: this.id, type: "tx-received", txHash: tx.hash, via, accepted: false, reason });
      return { ok: false, reason };
    }
    this.mempool.set(tx.hash, tx);
    log.push({ t: now, node: this.id, type: "tx-received", txHash: tx.hash, via, accepted: true });
    this.gossip("tx", tx, via, now, net);
    return { ok: true };
  }

  private gossip(kind: "tx" | "block", payload: Tx | Block, except: NodeId | "rpc", now: number, net: Network) {
    for (const p of this.peers) if (p !== except) net.send(this.id, p, kind, payload, now);
  }

  /** Pick includable txs from the mempool, execute them, seal a block, and gossip it. */
  propose(now: number, net: Network, log: SimEvent[]): Block | null {
    if (!this.online) return null;
    const parent = this.head();
    const working = this.state.clone();
    const txs: Tx[] = [];
    // Highest gasPrice first, then by nonce so a sender's txs land in order.
    const candidates = [...this.mempool.values()].sort((a, b) => b.gasPrice - a.gasPrice || a.nonce - b.nonce);
    for (const tx of candidates) {
      if (txs.length >= MAX_TXS_PER_BLOCK) break;
      if (working.canInclude(tx).ok) {
        // Execute against working state so subsequent nonce checks see the update.
        working.applyTx(tx, this.address, { blockNumber: parent.header.number + 1, blockHash: "0x", index: txs.length });
        txs.push(tx);
      }
    }
    const header: BlockHeader = {
      number: parent.header.number + 1,
      parentHash: parent.hash,
      timestamp: now,
      proposer: this.address,
      txRoot: txRootOf(txs),
      stateRoot: working.root(),
    };
    const block: Block = { header, hash: headerHash(header), txs, receipts: [] };
    log.push({ t: now, node: this.id, type: "block-proposed", blockHash: block.hash, number: header.number, txCount: txs.length });
    this.seenBlock.add(block.hash);
    this.applyBlock(block);
    this.gossip("block", block, "rpc", now, net);
    return block;
  }

  receiveBlock(block: Block, via: NodeId, now: number, net: Network, log: SimEvent[]) {
    if (!this.online) return;
    if (this.seenBlock.has(block.hash)) return;
    this.seenBlock.add(block.hash);
    const v = this.validateBlock(block);
    log.push({ t: now, node: this.id, type: "block-received", blockHash: block.hash, number: block.header.number, via, accepted: v.ok, reason: v.ok ? undefined : v.reason });
    if (!v.ok) return;
    this.applyBlock(block);
    this.gossip("block", block, via, now, net);
  }

  /** Full verification: header hash, parent linkage, tx root, then re-execute and compare state root. */
  validateBlock(block: Block): { ok: true } | { ok: false; reason: string } {
    if (headerHash(block.header) !== block.hash) return { ok: false, reason: "header hash mismatch" };
    const head = this.head();
    if (block.header.parentHash !== head.hash) return { ok: false, reason: `parent ${block.header.parentHash.slice(0, 10)} is not my head ${head.hash.slice(0, 10)}` };
    if (block.header.number !== head.header.number + 1) return { ok: false, reason: "bad block number" };
    if (txRootOf(block.txs) !== block.header.txRoot) return { ok: false, reason: "tx root mismatch" };
    const working = this.state.clone();
    for (const [i, tx] of block.txs.entries()) {
      if (!verifyTx(tx).ok) return { ok: false, reason: `tx ${i} bad signature` };
      const c = working.canInclude(tx);
      if (!c.ok) return { ok: false, reason: `tx ${i} not includable: ${c.reason}` };
      working.applyTx(tx, block.header.proposer, { blockNumber: block.header.number, blockHash: block.hash, index: i });
    }
    if (working.root() !== block.header.stateRoot) return { ok: false, reason: "state root mismatch" };
    return { ok: true };
  }

  private applyBlock(block: Block) {
    const receipts: Receipt[] = [];
    for (const [i, tx] of block.txs.entries()) {
      const r = this.state.applyTx(tx, block.header.proposer, { blockNumber: block.header.number, blockHash: block.hash, index: i });
      receipts.push(r);
      this.receipts.set(tx.hash, r);
      this.txIndex.set(tx.hash, tx);
      this.mempool.delete(tx.hash);
    }
    this.chain.push({ ...block, receipts });
    // Evict mempool txs that can never be included now (nonce already consumed by this block).
    for (const [h, tx] of this.mempool) if (tx.nonce < this.state.get(tx.from).nonce) this.mempool.delete(h);
  }
}
