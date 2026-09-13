"use client";
import { useSim } from "@/store/useSim";
import { short } from "@/sim/crypto";
import { headerHash } from "@/sim/block";
import { Panel, Mono, Tag } from "./ui";
import { useState } from "react";
import { fmtEth } from "@/lib/eth";

export function BlockInspector() {
  useSim((s) => s.version);
  const sim = useSim((s) => s.sim);
  const nodeId = useSim((s) => s.selectedNode);
  const hash = useSim((s) => s.selectedBlock);
  const selectTx = useSim((s) => s.selectTx);
  const [tamper, setTamper] = useState(0);
  const node = sim.nodes[nodeId];
  const block = hash ? node.chain.find((b) => b.hash === hash) : null;

  if (!block) {
    return (
      <Panel title="Block inspector">
        <p className="text-xs text-zinc-500">Select a block in the chain view to see its header, transactions, and receipts.</p>
      </Panel>
    );
  }
  const tampered = { ...block.header, timestamp: block.header.timestamp + tamper };
  const recomputed = headerHash(tampered);
  const child = node.chain[block.header.number + 1];
  const names = (a: string) => sim.accounts.findIndex((k) => k.address === a);
  const label = (a: string) => { const i = names(a); return i >= 0 ? `wallet ${i}` : sim.nodes.find((n) => n.address === a)?.name ?? short(a); };

  return (
    <Panel title={`Block #${block.header.number}`} right={<button className="text-[11px] text-zinc-500 hover:text-zinc-300" onClick={() => useSim.getState().selectBlock(null)}>close</button>}>
      <div className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[110px_1fr]">
        <span className="text-zinc-500">hash</span><Mono className="break-all text-amber-300">{block.hash}</Mono>
        <span className="text-zinc-500">parentHash</span><Mono className="break-all text-zinc-300">{block.header.parentHash}</Mono>
        <span className="text-zinc-500">number</span><Mono>{block.header.number}</Mono>
        <span className="text-zinc-500">timestamp</span>
        <span className="flex items-center gap-2"><Mono>{tampered.timestamp}</Mono>
          <button className="rounded border border-zinc-700 px-1.5 text-[10px] text-zinc-400 hover:bg-zinc-800" onClick={() => setTamper((t) => t + 1)}>+1 (tamper)</button>
          {tamper > 0 && <button className="text-[10px] text-zinc-500 underline" onClick={() => setTamper(0)}>undo</button>}
        </span>
        <span className="text-zinc-500">proposer</span><Mono>{label(block.header.proposer)} <span className="text-zinc-500">{short(block.header.proposer, 6)}</span></Mono>
        <span className="text-zinc-500">txRoot</span><Mono className="break-all text-zinc-300">{block.header.txRoot}</Mono>
        <span className="text-zinc-500">stateRoot</span><Mono className="break-all text-zinc-300">{block.header.stateRoot}</Mono>
      </div>
      {tamper > 0 && (
        <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
          <div>Recomputed hash of the edited header: <Mono className="break-all">{recomputed}</Mono></div>
          <div className="mt-1">≠ stored hash. Every node would reject this block.{child && <> And block #{child.header.number} points at <Mono>{short(child.header.parentHash, 5)}</Mono>, so the whole chain after it breaks too.</>}</div>
        </div>
      )}
      <h3 className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Transactions ({block.txs.length})</h3>
      {block.txs.length === 0 && <p className="text-xs text-zinc-600">Empty block. Proposer earned no fees.</p>}
      <ul className="space-y-1">
        {block.txs.map((tx, i) => {
          const r = block.receipts[i];
          return (
            <li key={tx.hash} className="flex flex-wrap items-center gap-2 rounded bg-zinc-950 px-2 py-1 text-xs">
              <span className="text-zinc-600">{i}</span>
              <button className="font-mono text-sky-300 hover:underline" onClick={() => selectTx(tx.hash)}>{short(tx.hash, 5)}</button>
              <span className="text-zinc-400">{label(tx.from)} → {label(tx.to)}</span>
              <Mono className="text-zinc-200">{fmtEth(tx.value)}</Mono>
              <span className="text-zinc-600">nonce {tx.nonce} · {tx.gasPrice} gwei</span>
              <span className="ml-auto"><Tag color={r?.status === "success" ? "emerald" : "rose"}>{r?.status}</Tag></span>
              {r?.error && <span className="w-full text-[10px] text-rose-300/80">{r.error}</span>}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
