"use client";
import { useState } from "react";
import { useSim } from "@/store/useSim";
import { short } from "@/sim/crypto";
import { encodeRawTx } from "@/sim/tx";
import { fmtEth, parseEth, ETH } from "@/lib/eth";
import { Panel, Mono, btn, input } from "./ui";

export function Wallet() {
  useSim((s) => s.version);
  const sim = useSim((s) => s.sim);
  const nodeId = useSim((s) => s.selectedNode);
  const rpc = useSim((s) => s.rpc);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(1);
  const [value, setValue] = useState("0.1");
  const [gasPrice, setGasPrice] = useState("1");
  const [last, setLast] = useState<{ hash: string; sig: string; raw: string; res: unknown } | null>(null);
  const node = sim.nodes[nodeId];

  const send = () => {
    // Step 1: ask the node what nonce to use (pending = include txs still in mempool).
    const nonceRes = rpc(nodeId, "eth_getTransactionCount", [sim.accounts[from].address, "pending"]) as { result?: string };
    const nonce = nonceRes.result ? parseInt(nonceRes.result, 16) : node.state.get(sim.accounts[from].address).nonce;
    // Step 2: sign locally. The private key never leaves the wallet.
    const tx = sim.buildAndSign(from, sim.accounts[to].address, parseEth(value), parseInt(gasPrice) || 1, nonce);
    // Step 3: hand the signed bytes to the node over RPC.
    const raw = encodeRawTx(tx);
    const res = rpc(nodeId, "eth_sendRawTransaction", [raw]);
    setLast({ hash: tx.hash, sig: tx.sig, raw, res });
  };

  return (
    <Panel title="Wallet" right={<span className="text-[11px] text-zinc-500">connected to <span className="text-sky-300">{node.name}</span></span>}>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col gap-1 text-zinc-500">from
          <select className={input} value={from} onChange={(e) => setFrom(+e.target.value)}>
            {sim.accounts.map((k, i) => <option key={k.address} value={i}>wallet {i} · {short(k.address, 4)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-zinc-500">to
          <select className={input} value={to} onChange={(e) => setTo(+e.target.value)}>
            {sim.accounts.map((k, i) => <option key={k.address} value={i}>wallet {i} · {short(k.address, 4)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-zinc-500">value (ETH)
          <input className={input} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-zinc-500">gasPrice (gwei)
          <input className={input} value={gasPrice} onChange={(e) => setGasPrice(e.target.value)} />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button className={`${btn} bg-sky-600 border-sky-500 hover:bg-sky-500`} onClick={send}>sign & send</button>
        <button className={btn} onClick={() => { for (let i = 0; i < 5; i++) { const f = Math.floor(Math.random() * sim.accounts.length); const t = Math.floor(Math.random() * sim.accounts.length); const n = Math.floor(Math.random() * sim.nodes.length); const nonceRes = rpc(n, "eth_getTransactionCount", [sim.accounts[f].address, "pending"]) as { result?: string }; if (!nonceRes.result) continue; const tx = sim.buildAndSign(f, sim.accounts[t].address, Math.round(Math.random() * 500) / 1000 * ETH, 1 + Math.floor(Math.random() * 3), parseInt(nonceRes.result, 16)); rpc(n, "eth_sendRawTransaction", [encodeRawTx(tx)]); } }}>spam 5 random txs</button>
        <span className="text-[11px] text-zinc-500">balance: <Mono>{fmtEth(node.state.get(sim.accounts[from].address).balance)}</Mono> · nonce <Mono>{node.state.get(sim.accounts[from].address).nonce}</Mono></span>
      </div>
      {last && (
        <div className="mt-3 space-y-1 rounded bg-zinc-950 p-2 text-[11px]">
          <div className="text-zinc-500">1. wallet signs locally → signature <Mono className="break-all text-zinc-300">{short(last.sig, 10)}</Mono></div>
          <div className="text-zinc-500">2. <Mono>eth_sendRawTransaction</Mono> to {node.name} with raw bytes <Mono className="text-zinc-400">{short(last.raw, 8)}</Mono></div>
          <div className="text-zinc-500">3. node replies: <Mono className="break-all text-sky-300">{JSON.stringify(last.res)}</Mono></div>
          <div className="text-zinc-600">tx hash = keccak(unsignedHash ‖ sig). Watch it gossip out from {node.name} in the network view.</div>
        </div>
      )}
    </Panel>
  );
}
