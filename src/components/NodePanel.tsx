"use client";
import { useSim } from "@/store/useSim";
import { short } from "@/sim/crypto";
import { Panel, Mono } from "./ui";
import { fmtEth } from "@/lib/eth";

export function NodePanel() {
  useSim((s) => s.version);
  const sim = useSim((s) => s.sim);
  const nodeId = useSim((s) => s.selectedNode);
  const node = sim.nodes[nodeId];
  const label = (a: string) => { const i = sim.accounts.findIndex((k) => k.address === a); return i >= 0 ? `wallet ${i}` : sim.nodes.find((n) => n.address === a)?.name ?? short(a); };
  const pending = [...node.mempool.values()].sort((a, b) => b.gasPrice - a.gasPrice || a.nonce - b.nonce);

  return (
    <Panel title={`${node.name} · mempool & state`} right={<span className="text-[11px] text-zinc-500">peers: {node.peers.map((p) => sim.nodes[p].name.split(" ")[0]).join(", ")}</span>}>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Mempool ({pending.length} pending)</h3>
          {pending.length === 0 && <p className="text-xs text-zinc-600">Empty. Send a transaction from the wallet.</p>}
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {pending.map((tx) => {
              const c = node.state.canInclude(tx);
              return (
                <li key={tx.hash} className="rounded bg-zinc-950 px-2 py-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Mono className="text-sky-300">{short(tx.hash, 4)}</Mono>
                    <span className="text-zinc-400">{label(tx.from)} → {label(tx.to)}</span>
                    <Mono className="ml-auto">{fmtEth(tx.value)}</Mono>
                  </div>
                  <div className="text-[10px] text-zinc-600">nonce {tx.nonce} · gasPrice {tx.gasPrice}{!c.ok && <span className="text-amber-400"> · waiting: {c.reason}</span>}</div>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">State (this node&apos;s copy)</h3>
          <table className="w-full text-xs">
            <thead className="text-[10px] text-zinc-500"><tr><th className="text-left font-normal">account</th><th className="text-right font-normal">balance (ETH)</th><th className="text-right font-normal">nonce</th></tr></thead>
            <tbody>
              {sim.accounts.map((k, i) => { const a = node.state.get(k.address); return (
                <tr key={k.address} className="border-t border-zinc-800/60">
                  <td className="py-0.5">wallet {i} <Mono className="text-zinc-500">{short(k.address, 3)}</Mono></td>
                  <td className="py-0.5 text-right font-mono">{fmtEth(a.balance, { unit: false })}</td>
                  <td className="py-0.5 text-right font-mono text-zinc-400">{a.nonce}</td>
                </tr>); })}
              {sim.nodes.filter((n) => node.state.get(n.address).balance > 0).map((n) => (
                <tr key={n.address} className="border-t border-zinc-800/60 text-zinc-400">
                  <td className="py-0.5">{n.name} <span className="text-[10px] text-zinc-600">(fees)</span></td>
                  <td className="py-0.5 text-right font-mono">{fmtEth(node.state.get(n.address).balance, { unit: false })}</td>
                  <td className="py-0.5 text-right font-mono">{node.state.get(n.address).nonce}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 text-[10px] text-zinc-600">stateRoot <Mono>{short(node.state.root(), 6)}</Mono></div>
        </div>
      </div>
    </Panel>
  );
}
