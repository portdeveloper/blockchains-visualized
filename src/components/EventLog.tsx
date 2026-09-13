"use client";
import { useSim } from "@/store/useSim";
import { short } from "@/sim/crypto";
import { Panel } from "./ui";

export function EventLog() {
  useSim((s) => s.version);
  const sim = useSim((s) => s.sim);
  const events = sim.log.slice(-40).reverse();
  const name = (id: number | "rpc") => (id === "rpc" ? "wallet (RPC)" : sim.nodes[id].name);
  return (
    <Panel title="Event log" className="min-h-0">
      <ul className="max-h-64 space-y-0.5 overflow-y-auto font-mono text-[10px]">
        {events.map((e, i) => (
          <li key={i} className={`flex gap-2 ${"accepted" in e && !e.accepted ? "text-rose-300" : "text-zinc-400"}`}>
            <span className="w-12 shrink-0 text-zinc-600">{(e.t / 1000).toFixed(2)}s</span>
            <span className="w-24 shrink-0 truncate text-zinc-300">{sim.nodes[e.node].name}</span>
            {e.type === "tx-received" && <span><span className="text-sky-400">tx</span> {short(e.txHash, 3)} from {name(e.via)} {e.accepted ? "→ mempool" : `✗ ${e.reason}`}</span>}
            {e.type === "block-proposed" && <span><span className="text-amber-400">proposed #{e.number}</span> {short(e.blockHash, 3)} with {e.txCount} tx</span>}
            {e.type === "block-received" && <span><span className="text-amber-400">block #{e.number}</span> from {name(e.via)} {e.accepted ? "✓ validated, applied" : `✗ ${e.reason}`}</span>}
          </li>
        ))}
        {events.length === 0 && <li className="text-zinc-600">Waiting for the first block…</li>}
      </ul>
    </Panel>
  );
}
