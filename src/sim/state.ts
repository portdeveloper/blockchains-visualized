import { Hex, keccak, fromHex } from "./crypto";
import { Tx, txFee, gasFor } from "./tx";
import { CONTRACTS, Log, decodeData, isDeploy } from "./contracts";

export interface Account {
  balance: number;
  nonce: number;
  /** Contract accounts: which program lives here, and its storage. */
  code?: string;
  storage?: Record<string, unknown>;
}

export interface Receipt {
  txHash: Hex;
  status: "success" | "failed";
  gasUsed: number;
  fee: number;
  error?: string;
  logs: Log[];
  contractAddress?: Hex;
  blockNumber: number;
  blockHash: Hex;
  index: number;
}

/** World state: address → account. Toy version of Ethereum's state trie. */
export class State {
  accounts = new Map<Hex, Account>();

  clone(): State {
    const s = new State();
    for (const [k, v] of this.accounts) s.accounts.set(k, structuredClone(v));
    return s;
  }

  get(addr: Hex): Account {
    return this.accounts.get(addr) ?? { balance: 0, nonce: 0 };
  }

  set(addr: Hex, acct: Account) {
    this.accounts.set(addr, acct);
  }

  /** Deterministic commitment to the whole state. Real chains use a Merkle-Patricia trie root. */
  root(): Hex {
    const entries = [...this.accounts.entries()].filter(([, a]) => a.balance > 0 || a.nonce > 0 || a.code).sort(([a], [b]) => (a < b ? -1 : 1));
    return keccak(JSON.stringify(entries));
  }

  /**
   * Is this tx includable in a block on top of this state?
   * Not includable ≠ failed. A failed tx is included and pays gas; a non-includable tx is simply never mined.
   */
  canInclude(tx: Tx): { ok: true } | { ok: false; reason: string } {
    const acct = this.get(tx.from);
    if (tx.nonce < acct.nonce) return { ok: false, reason: `nonce ${tx.nonce} already used (account at ${acct.nonce})` };
    if (tx.nonce > acct.nonce) return { ok: false, reason: `nonce gap: expected ${acct.nonce}, got ${tx.nonce}` };
    if (acct.balance < txFee(tx)) return { ok: false, reason: `cannot afford gas fee ${txFee(tx)}` };
    return { ok: true };
  }

  /** Address of a contract created by `sender` at `nonce`. Ethereum: keccak(rlp(sender, nonce))[12:]. */
  static contractAddress(sender: Hex, nonce: number): Hex {
    return keccak(new Uint8Array([...fromHex(sender), nonce & 255, (nonce >> 8) & 255])).slice(0, 2) + keccak(`${sender}:${nonce}`).slice(26);
  }

  /** Free read: run a view method against this state without changing it. */
  call(to: Hex, method: string, args: unknown[]): unknown {
    const acct = this.get(to);
    const type = acct.code ? CONTRACTS[acct.code] : undefined;
    if (!type) throw new Error(`no contract at ${to}`);
    const m = type.methods[method];
    if (!m) throw new Error(`no method ${method}`);
    if (!m.view) throw new Error(`${method} changes state; send a transaction instead`);
    return m.run({ sender: "0x" + "0".repeat(40), storage: structuredClone(acct.storage ?? {}), emit: () => {} }, args);
  }

  /** Mutates state. Caller must have checked canInclude. */
  applyTx(tx: Tx, proposer: Hex, ctx: { blockNumber: number; blockHash: Hex; index: number }): Receipt {
    const fee = txFee(tx);
    const from = { ...this.get(tx.from) };
    from.nonce += 1;
    from.balance -= fee;
    this.set(tx.from, from);
    const p = { ...this.get(proposer) };
    p.balance += fee;
    this.set(proposer, p);

    let status: Receipt["status"] = "success";
    let error: string | undefined;
    const logs: Log[] = [];
    let contractAddress: Hex | undefined;
    // Everything below runs on a scratch copy so a failure reverts cleanly while the fee above stays paid.
    const scratch = this.clone();
    try {
      if (scratch.get(tx.from).balance < tx.value) throw new Error(`insufficient balance: have ${scratch.get(tx.from).balance}, need ${tx.value}`);
      const f = { ...scratch.get(tx.from) }; f.balance -= tx.value; scratch.set(tx.from, f);
      if (tx.data) {
        const d = decodeData(tx.data);
        const emit = (l: Log) => logs.push(l);
        if (isDeploy(d)) {
          const type = CONTRACTS[d.deploy];
          if (!type) throw new Error(`unknown contract type ${d.deploy}`);
          contractAddress = State.contractAddress(tx.from, tx.nonce);
          const storage: Record<string, unknown> = {};
          type.init({ sender: tx.from, storage, emit }, d.args);
          scratch.set(contractAddress, { balance: tx.value, nonce: 1, code: d.deploy, storage });
        } else {
          const acct = scratch.get(tx.to);
          const type = acct.code ? CONTRACTS[acct.code] : undefined;
          if (!type) throw new Error(`no contract at ${tx.to}`);
          const m = type.methods[d.method];
          if (!m) throw new Error(`no method ${d.method}`);
          const storage = structuredClone(acct.storage ?? {});
          m.run({ sender: tx.from, storage, emit }, d.args);
          scratch.set(tx.to, { ...acct, balance: acct.balance + tx.value, storage });
        }
      } else {
        const t = { ...scratch.get(tx.to) }; t.balance += tx.value; scratch.set(tx.to, t);
      }
      this.accounts = scratch.accounts;
    } catch (e) {
      status = "failed";
      error = (e as Error).message;
      logs.length = 0;
      contractAddress = undefined;
    }
    return { txHash: tx.hash, status, gasUsed: gasFor(tx), fee, error, logs, contractAddress, ...ctx };
  }
}
