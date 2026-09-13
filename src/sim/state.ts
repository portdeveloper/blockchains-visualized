import { Hex, keccak } from "./crypto";
import { GAS_PER_TX, Tx, txFee } from "./tx";

export interface Account {
  balance: number;
  nonce: number;
}

export interface Receipt {
  txHash: Hex;
  status: "success" | "failed";
  gasUsed: number;
  fee: number;
  error?: string;
  blockNumber: number;
  blockHash: Hex;
  index: number;
}

/** World state: address → account. Toy version of Ethereum's state trie. */
export class State {
  accounts = new Map<Hex, Account>();

  clone(): State {
    const s = new State();
    for (const [k, v] of this.accounts) s.accounts.set(k, { ...v });
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
    const entries = [...this.accounts.entries()].filter(([, a]) => a.balance > 0 || a.nonce > 0).sort(([a], [b]) => (a < b ? -1 : 1));
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
    if (this.get(tx.from).balance >= tx.value) {
      const f = { ...this.get(tx.from) };
      f.balance -= tx.value;
      this.set(tx.from, f);
      const t = { ...this.get(tx.to) };
      t.balance += tx.value;
      this.set(tx.to, t);
    } else {
      status = "failed";
      error = `insufficient balance: have ${this.get(tx.from).balance}, need ${tx.value}`;
    }
    return { txHash: tx.hash, status, gasUsed: GAS_PER_TX, fee, error, ...ctx };
  }
}
