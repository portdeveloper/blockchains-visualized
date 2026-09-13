"use client";
import { motion } from "motion/react";
import { useLive } from "@/store/useLive";
import { short } from "@/sim/crypto";
import { Block } from "@/sim/block";
import { accountName } from "./BrowserWallet";
import { fmtEth, fmtDelta } from "@/lib/eth";

export function BlockDetail({ block, onClose, width }: { block: Block; onClose: () => void; width: number }) {
  useLive((s) => s.version);
  const { sim, rpcNode } = useLive();
  const n = block.header.number;
  const before = sim.stateAt(rpcNode, n - 1);
  const after = sim.stateAt(rpcNode, n);
  const name = (a: string) => accountName(sim, a, "long") ?? sim.nodes.find((nd) => nd.address === a)?.name ?? short(a, 3);
  const touched = new Set<string>();
  block.txs.forEach((tx) => { touched.add(tx.from); touched.add(tx.to); });
  if (block.txs.length) touched.add(block.header.proposer);
  const rows = [...touched].map((a) => ({ a, b: before.get(a), af: after.get(a) })).filter((r) => r.b.balance !== r.af.balance || r.b.nonce !== r.af.nonce);
  const fees = block.receipts.reduce((s, r) => s + r.fee, 0);
  const depth = sim.nodes[rpcNode].head().header.number - n;

  return (
    <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.25 }}
      data-nopan className="absolute right-0 top-0 z-40 flex h-full flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950/95 p-5 backdrop-blur" style={{ width }}>
      <div className="text-[11px] uppercase tracking-wider text-amber-400">block · {depth === 0 ? "newest" : `${depth} deep`}</div>
      <h2 className="mt-1 text-xl font-semibold text-zinc-100">Block #{n}</h2>
      <dl className="mt-3 space-y-1 font-mono text-[11px]">
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">hash</dt><dd className="truncate text-amber-300">{short(block.hash, 8)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">parent</dt><dd className="truncate text-zinc-300">{short(block.header.parentHash, 8)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">proposer</dt><dd className="text-zinc-300">{name(block.header.proposer)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">time</dt><dd className="text-zinc-300">{(block.header.timestamp / 1000).toFixed(1)}s</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">state root before</dt><dd className="truncate text-zinc-400">{short(sim.nodes[rpcNode].chain[n - 1]?.header.stateRoot ?? "", 6)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-zinc-500">state root after</dt><dd className="truncate text-emerald-300">{short(block.header.stateRoot, 6)}</dd></div>
      </dl>

      <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">What this block changed</h3>
      <p className="mt-1 text-xs text-zinc-400">Every node ran these {block.txs.length} transaction{block.txs.length === 1 ? "" : "s"} in order and arrived at the same balances. The state root is a fingerprint of the result.</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">Nothing changed. Empty block, no fees.</p>
      ) : (
        <table className="mt-2 w-full text-[11px]">
          <thead className="text-[10px] text-zinc-500"><tr><th className="text-left font-normal">account</th><th className="text-right font-normal">before (ETH)</th><th className="text-right font-normal">after (ETH)</th><th className="text-right font-normal">Δ</th></tr></thead>
          <tbody>
            {rows.map((r) => { const d = r.af.balance - r.b.balance; return (
              <tr key={r.a} className="border-t border-zinc-800/70 font-mono">
                <td className="py-1 text-zinc-300">{name(r.a)}{r.af.nonce !== r.b.nonce && <span className="ml-1 text-[9px] text-zinc-500">nonce {r.b.nonce}→{r.af.nonce}</span>}</td>
                <td className="py-1 text-right text-zinc-500">{fmtEth(r.b.balance, { unit: false })}</td>
                <td className="py-1 text-right text-zinc-200">{fmtEth(r.af.balance, { unit: false })}</td>
                <td className={`py-1 text-right ${d > 0 ? "text-emerald-300" : d < 0 ? "text-rose-300" : "text-zinc-500"}`}>{fmtDelta(d)}</td>
              </tr>); })}
          </tbody>
        </table>
      )}
      {fees > 0 && <p className="mt-3 rounded bg-amber-500/10 p-2 text-[11px] text-amber-200">Fees in this block: {fmtEth(fees)}, paid to {name(block.header.proposer)} for doing the work of proposing it.</p>}
      <button className="mt-auto self-start pt-6 text-sm text-zinc-500 hover:text-zinc-300" onClick={onClose}>close</button>
    </motion.aside>
  );
}
