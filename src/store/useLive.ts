"use client";
import { create } from "zustand";
import { Simulation } from "@/sim/sim";
import { encodeRawTx, Tx } from "@/sim/tx";
import { Hex } from "@/sim/crypto";
import { ETH, fmtEth } from "@/lib/eth";

export type Hop = "app→rpc" | "rpc→node" | "node→rpc" | "rpc→app" | "bob→rpc2" | "rpc2→node2" | "node2→rpc2" | "rpc2→bob";
export type Owner = "you" | "bob";
export interface Flight {
  id: number;
  label: string;
  hop: Hop;
  kind: "req" | "res" | "poll";
  ms: number;
}

export interface AppTx {
  owner: Owner;
  hash: Hex;
  tx: Tx;
  signedAt?: number;
  sentAt?: number;
  receiptAt?: number;
  to: number;
  value: number;
  status: "signing" | "sent" | "pending" | "mined" | "rejected";
  block?: number;
  fee?: number;
  error?: string;
  at: number;
}

interface LiveStore {
  sim: Simulation;
  version: number;
  running: boolean;
  speed: number;
  traffic: boolean;
  rpcNode: number;
  bobNode: number;
  bobAccount: number;
  flights: Flight[];
  appTxs: AppTx[];
  lastRpc: { method: string; params: unknown[]; response: unknown } | null;
  lastRpcBob: { method: string; params: unknown[]; response: unknown } | null;
  tracked: Hex | null;
  setTracked: (h: Hex | null) => void;
  balance: number;
  blockNumber: number;
  bobBalance: number;
  bobBlockNumber: number;
  incoming: { id: string; owner: Owner; from: string; value: number; block: number }[];
  /** Last block applied by the RPC node, with where each tx sat in the mempool list just before. Drives the fly animation. */
  lastApplied: { blockHash: string; entries: { hash: Hex; blockIdx: number; mempoolIdx: number | null }[] } | null;
  tick: (dt: number) => void;
  setRunning: (r: boolean) => void;
  setSpeed: (s: number) => void;
  setTraffic: (t: boolean) => void;
  addFlight: (f: Omit<Flight, "id">) => void;
  removeFlight: (id: number) => void;
  send: (to: number, value: number, as?: Owner) => Promise<void>;
  poll: () => void;
  reset: () => void;
}

let fid = 1;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BASE_HOP_MS = 450;
const hop = () => BASE_HOP_MS / get_speed();
let get_speed = () => 1;

export const useLive = create<LiveStore>((set, get) => {
  get_speed = () => get().speed;
  return {
  sim: new Simulation({ seed: 7, nodeCount: 4, blockTimeMs: 12000, accountCount: 5, initialBalance: 10 * ETH }),
  version: 0,
  running: true,
  speed: 1,
  traffic: true,
  rpcNode: 0,
  bobNode: 2,
  bobAccount: 1,
  flights: [],
  appTxs: [],
  lastRpc: null,
  lastRpcBob: null,
  tracked: null,
  setTracked: (tracked) => set({ tracked }),
  balance: 10 * ETH,
  blockNumber: 0,
  bobBalance: 10 * ETH,
  bobBlockNumber: 0,
  incoming: [],
  lastApplied: null,
  tick: (dt) => {
    const { sim, traffic, rpcNode } = get();
    const rn = sim.nodes[rpcNode];
    const headBefore = rn.head().hash;
    const snapshot = new Map<Hex, number>();
    [...rn.mempool.values()].sort((a, b) => b.gasPrice - a.gasPrice || a.nonce - b.nonce).forEach((tx, i) => snapshot.set(tx.hash, i));
    // Background traffic: other people's wallets, talking to other nodes.
    if (traffic && Math.random() < dt / 1800) {
      const f = 1 + Math.floor(Math.random() * (sim.accounts.length - 1));
      let t = Math.floor(Math.random() * sim.accounts.length);
      if (t === f) t = (t + 1) % sim.accounts.length;
      const n = Math.floor(Math.random() * sim.nodes.length);
      const nonceRes = sim.rpc(n, { method: "eth_getTransactionCount", params: [sim.accounts[f].address, "pending"] });
      if (nonceRes.result) {
        const tx = sim.buildAndSign(f, sim.accounts[t].address, Math.round((0.01 + Math.random() * 0.49) * 1000) / 1000 * ETH, 1 + Math.floor(Math.random() * 3), parseInt(nonceRes.result as string, 16));
        sim.rpc(n, { method: "eth_sendRawTransaction", params: [encodeRawTx(tx)] });
      }
    }
    sim.step(dt);
    const head = rn.head();
    if (head.hash !== headBefore) {
      set({ lastApplied: { blockHash: head.hash, entries: head.txs.map((tx, i) => ({ hash: tx.hash, blockIdx: i, mempoolIdx: snapshot.has(tx.hash) && snapshot.get(tx.hash)! < 9 ? snapshot.get(tx.hash)! : null })) } });
    }
    set((s) => ({ version: s.version + 1 }));
  },
  setRunning: (running) => set({ running }),
  setSpeed: (speed) => set({ speed }),
  setTraffic: (traffic) => set({ traffic }),
  addFlight: (f) => set((s) => ({ flights: [...s.flights, { ...f, id: fid++ }] })),
  removeFlight: (id) => set((s) => ({ flights: s.flights.filter((f) => f.id !== id) })),

  /** The app's send flow, animated hop by hop so the learner sees each leg. Works for you (left) and Bob (right). */
  send: async (to, value, as = "you") => {
    const { sim, addFlight } = get();
    const acctIdx = as === "you" ? 0 : get().bobAccount;
    const nodeId = as === "you" ? get().rpcNode : get().bobNode;
    const lanes: Record<Owner, [Hop, Hop, Hop, Hop]> = { you: ["app→rpc", "rpc→node", "node→rpc", "rpc→app"], bob: ["bob→rpc2", "rpc2→node2", "node2→rpc2", "rpc2→bob"] };
    const [l1, l2, l3, l4] = lanes[as];
    const me = sim.accounts[acctIdx];
    const node = sim.nodes[nodeId];
    const nonce = (() => {
      const r = sim.rpc(nodeId, { method: "eth_getTransactionCount", params: [me.address, "pending"] });
      return r.result ? parseInt(r.result as string, 16) : node.state.get(me.address).nonce;
    })();
    const tx = sim.buildAndSign(acctIdx, sim.accounts[to].address, value, 2, nonce);
    const entry: AppTx = { owner: as, hash: tx.hash, tx, to, value, status: "signing", at: sim.now };
    set((s) => ({ appTxs: [entry, ...s.appTxs].slice(0, 10), tracked: tx.hash }));
    await wait(500 / get().speed);
    const upd = (patch: Partial<AppTx>) => set((s) => ({ appTxs: s.appTxs.map((t) => (t.hash === tx.hash ? { ...t, ...patch } : t)) }));
    upd({ status: "sent", signedAt: get().sim.now });
    addFlight({ label: "eth_sendRawTransaction · costs gas", hop: l1, kind: "req", ms: hop() });
    await wait(hop());
    addFlight({ label: "raw tx", hop: l2, kind: "req", ms: hop() });
    await wait(hop());
    const params = [encodeRawTx(tx)];
    upd({ sentAt: sim.now });
    const res = sim.rpc(nodeId, { method: "eth_sendRawTransaction", params });
    const last = { method: "eth_sendRawTransaction", params: [params[0].slice(0, 18) + "…"], response: res };
    set(as === "you" ? { lastRpc: last } : { lastRpcBob: last });
    addFlight({ label: res.error ? "error" : "tx hash", hop: l3, kind: "res", ms: hop() });
    await wait(hop());
    addFlight({ label: res.error ? res.error.message : "0x" + tx.hash.slice(2, 8) + "…", hop: l4, kind: "res", ms: hop() });
    await wait(hop());
    if (res.error) upd({ status: "rejected", error: res.error.message });
    else upd({ status: "pending" });
    set((s) => ({ version: s.version + 1 }));
  },

  /** What real apps do constantly: ask the RPC for the latest block and balance, and for receipts of pending txs. */
  poll: () => {
    const { sim, addFlight } = get();
    const sides: { owner: Owner; acct: number; node: number; req: Hop; res: Hop }[] = [
      { owner: "you", acct: 0, node: get().rpcNode, req: "app→rpc", res: "rpc→app" },
      { owner: "bob", acct: get().bobAccount, node: get().bobNode, req: "bob→rpc2", res: "rpc2→bob" },
    ];
    for (const side of sides) {
      const me = sim.accounts[side.acct];
      addFlight({ label: "read: eth_getBalance · free", hop: side.req, kind: "poll", ms: hop() });
      setTimeout(() => {
        const bn = sim.rpc(side.node, { method: "eth_blockNumber", params: [] });
        const bal = sim.rpc(side.node, { method: "eth_getBalance", params: [me.address, "latest"] });
        const prevBn = side.owner === "you" ? get().blockNumber : get().bobBlockNumber;
        const newBn = bn.result ? parseInt(bn.result as string, 16) : prevBn;
        // Incoming payments in blocks this site has not seen yet. Receiving needs no action from the user.
        const chain = sim.nodes[side.node].chain;
        const found: LiveStore["incoming"] = [];
        for (let n = prevBn + 1; n <= newBn && n < chain.length; n++)
          for (const tx of chain[n].txs) if (tx.to === me.address && tx.from !== me.address) found.push({ id: tx.hash, owner: side.owner, from: tx.from, value: tx.value, block: n });
        if (found.length) {
          set((s) => ({ incoming: [...s.incoming, ...found] }));
          const ids = found.map((f) => f.id);
          setTimeout(() => set((s) => ({ incoming: s.incoming.filter((x) => !ids.includes(x.id)) })), 5000 / get().speed);
        }
        const newBal = bal.result ? parseInt(bal.result as string, 16) : undefined;
        const last = { method: "eth_getBalance", params: [me.address.slice(0, 10) + "…", "latest"], response: bal };
        if (side.owner === "you") set({ blockNumber: newBn, balance: newBal ?? get().balance, lastRpc: last });
        else set({ bobBlockNumber: newBn, bobBalance: newBal ?? get().bobBalance, lastRpcBob: last });
        addFlight({ label: newBal !== undefined ? `balance ${fmtEth(newBal)}` : "error", hop: side.res, kind: "poll", ms: hop() });
        for (const t of get().appTxs.filter((t) => t.status === "pending" && t.owner === side.owner)) {
          const r = sim.rpc(side.node, { method: "eth_getTransactionReceipt", params: [t.hash] });
          const rec = r.result as { blockNumber: number; status: string; fee: number } | null;
          if (rec) {
            addFlight({ label: `receipt: block #${rec.blockNumber} ${rec.status}`, hop: side.res, kind: "res", ms: hop() });
            set((s) => ({ appTxs: s.appTxs.map((x) => (x.hash === t.hash ? { ...x, status: "mined", block: rec.blockNumber, fee: rec.fee, receiptAt: sim.now } : x)) }));
          }
        }
      }, hop());
    }
  },
  reset: () => set({ sim: new Simulation({ seed: Math.floor(Math.random() * 1e6), nodeCount: 4, blockTimeMs: 12000, accountCount: 5, initialBalance: 10 * ETH }), appTxs: [], flights: [], lastRpc: null, lastRpcBob: null, tracked: null, balance: 10 * ETH, blockNumber: 0, bobBalance: 10 * ETH, bobBlockNumber: 0, incoming: [], lastApplied: null, version: 0 }),
};
});
