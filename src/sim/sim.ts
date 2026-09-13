import { Block, BlockHeader, headerHash, txRootOf } from "./block";
import { Hex, Keypair, keypairFromPriv } from "./crypto";
import { Network, Message } from "./network";
import { Node, SimEvent } from "./node";
import { Rng } from "./rng";
import { handleRpc, RpcRequest, RpcResponse } from "./rpc";
import { State } from "./state";
import { signTx, UnsignedTx, Tx } from "./tx";

export interface SimOptions {
  seed?: number;
  nodeCount?: number;
  blockTimeMs?: number;
  accountCount?: number;
  initialBalance?: number;
}

const NODE_NAMES = ["Alice's node", "Bob's node", "Frankfurt", "Tokyo", "São Paulo", "Sydney", "Toronto", "Mumbai"];

/**
 * The whole world: a set of nodes, the network between them, a clock, and some funded wallets.
 * Deterministic: same seed → identical run given identical inputs.
 */
export class Simulation {
  now = 0;
  rng: Rng;
  nodes: Node[] = [];
  net = new Network();
  accounts: Keypair[] = [];
  log: SimEvent[] = [];
  blockTimeMs: number;
  nextProposalAt: number;
  proposerCursor = 0;
  genesis!: Block;
  genesisState!: State;

  constructor(opts: SimOptions = {}) {
    const seed = opts.seed ?? 42;
    this.rng = new Rng(seed);
    this.blockTimeMs = opts.blockTimeMs ?? 4000;
    this.nextProposalAt = this.blockTimeMs;

    const accountCount = opts.accountCount ?? 5;
    for (let i = 0; i < accountCount; i++) this.accounts.push(keypairFromPriv(this.rng.bytes(32)));

    const nodeCount = opts.nodeCount ?? 5;
    for (let i = 0; i < nodeCount; i++) {
      const kp = keypairFromPriv(this.rng.bytes(32));
      this.nodes.push(new Node(i, NODE_NAMES[i] ?? `Node ${i}`, kp.address, true));
    }
    // Topology: ring plus a few random extra links so gossip has multiple paths.
    for (let i = 0; i < nodeCount; i++) this.connect(i, (i + 1) % nodeCount);
    for (let k = 0; k < Math.max(1, nodeCount - 3); k++) {
      const a = this.rng.int(0, nodeCount - 1);
      const b = this.rng.int(0, nodeCount - 1);
      if (a !== b) this.connect(a, b);
    }

    // Genesis
    const state = new State();
    for (const a of this.accounts) state.set(a.address, { balance: opts.initialBalance ?? 1_000_000, nonce: 0 });
    const header: BlockHeader = { number: 0, parentHash: "0x" + "0".repeat(64), timestamp: 0, proposer: "0x" + "0".repeat(40), txRoot: txRootOf([]), stateRoot: state.root() };
    this.genesis = { header, hash: headerHash(header), txs: [], receipts: [] };
    this.genesisState = state;
    for (const n of this.nodes) n.init(this.genesis, state);
  }

  private connect(a: number, b: number) {
    const na = this.nodes[a], nb = this.nodes[b];
    if (na.peers.includes(b)) return;
    na.peers.push(b);
    nb.peers.push(a);
    this.net.setLatency(a, b, this.rng.int(150, 900));
  }

  /** Advance the clock by dt ms, delivering messages and proposing blocks as their times come due. */
  step(dt: number) {
    const target = this.now + dt;
    while (this.now < target) {
      const nextEvent = Math.min(target, this.nextProposalAt, ...this.net.inflight().map((m) => m.deliverAt));
      this.now = Math.max(this.now, nextEvent);
      for (const m of this.net.drain(this.now)) {
        const to = this.nodes[m.to];
        if (m.kind === "tx") to.receiveTx(m.payload as Tx, m.from, this.now, this.net, this.log);
        else to.receiveBlock(m.payload as Block, m.from, this.now, this.net, this.log);
      }
      if (this.now >= this.nextProposalAt) {
        this.proposeNext();
        this.nextProposalAt += this.blockTimeMs;
      }
      if (nextEvent >= target) break;
    }
    this.now = target;
    if (this.log.length > 500) this.log.splice(0, this.log.length - 500);
  }

  /** Round-robin proposer among online validators. (A stand-in for real leader election.) */
  private proposeNext() {
    const validators = this.nodes.filter((n) => n.validator && n.online);
    if (validators.length === 0) return;
    const proposer = validators[this.proposerCursor % validators.length];
    this.proposerCursor++;
    proposer.propose(this.now, this.net, this.log);
  }

  currentProposer(): Node | null {
    const validators = this.nodes.filter((n) => n.validator && n.online);
    if (validators.length === 0) return null;
    return validators[this.proposerCursor % validators.length];
  }

  rpc(nodeId: number, req: RpcRequest): RpcResponse {
    return handleRpc(this.nodes[nodeId], req, this.now, this.net, this.log);
  }

  /** Convenience for the wallet UI: sign with a known account. */
  buildAndSign(fromIdx: number, to: string, value: number, gasPrice: number, nonce: number, data?: string): Tx {
    const kp = this.accounts[fromIdx];
    const unsigned: UnsignedTx = { from: kp.address, to: to.toLowerCase(), value, nonce, gasPrice, ...(data ? { data } : {}) };
    return signTx(unsigned, kp.priv);
  }

  /** Replay a node's chain from genesis up to and including block n. Slow but fine for a toy chain. */
  stateAt(nodeId: number, n: number): State {
    const st = this.genesisState.clone();
    const chain = this.nodes[nodeId].chain;
    for (let i = 1; i <= n && i < chain.length; i++) {
      const b = chain[i];
      b.txs.forEach((tx, idx) => st.applyTx(tx, b.header.proposer, { blockNumber: b.header.number, blockHash: b.hash, index: idx }));
    }
    return st;
  }

  /** First contract of a given type in a node's state, if any. */
  findContract(nodeId: number, type: string): Hex | null {
    for (const [a, acct] of this.nodes[nodeId].state.accounts) if (acct.code === type) return a;
    return null;
  }

  inflight(): readonly Message[] {
    return this.net.inflight();
  }
}
