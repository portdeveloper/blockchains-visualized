"use client";
import { motion } from "motion/react";
import { useLive } from "@/store/useLive";
import { short } from "@/sim/crypto";
import { verifyTx, txFee } from "@/sim/tx";
import { accountName } from "./BrowserWallet";
import { fmtEth, fmtGwei } from "@/lib/eth";
import { decodeData } from "@/sim/contracts";

interface Stage { title: string; detail: React.ReactNode; state: "done" | "now" | "todo" | "bad"; t?: number }

export function Lifecycle({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  useLive((s) => s.version);
  const { sim, tracked, appTxs, rpcNode, setTracked } = useLive();
  const fmt = (t?: number) => (t === undefined ? "" : `${(t / 1000).toFixed(1)}s`);
  const walletName = (a: string) => accountName(sim, a) ?? short(a, 3);
  const nodeName = (a: string) => sim.nodes.find((n) => n.address === a)?.name ?? short(a, 3);

  let stages: Stage[] = [];
  let heading = <span className="text-zinc-500">Send a transaction, or click any transaction chip, to follow its life.</span>;

  if (tracked) {
    const app = appTxs.find((t) => t.hash === tracked);
    const tx = app?.tx ?? sim.nodes.map((n) => n.mempool.get(tracked) ?? n.txIndex.get(tracked)).find(Boolean);
    if (tx) {
      const events = sim.log.filter((e) => e.type === "tx-received" && e.txHash === tracked);
      const entry = events.find((e) => e.type === "tx-received" && e.via === "rpc");
      const known = sim.nodes.filter((n) => n.mempool.has(tracked) || n.txIndex.has(tracked));
      const receipt = sim.nodes[rpcNode].receipts.get(tracked) ?? sim.nodes.map((n) => n.receipts.get(tracked)).find(Boolean);
      const block = receipt ? sim.nodes[rpcNode].chain[receipt.blockNumber] : undefined;
      const confs = receipt ? sim.nodes[rpcNode].head().header.number - receipt.blockNumber : 0;
      const sig = verifyTx(tx);
      const rejected = app?.status === "rejected" || (entry && "accepted" in entry && !entry.accepted);
      const rejectReason = app?.error ?? (entry && "reason" in entry ? entry.reason : undefined);

      heading = (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-zinc-100">Life of transaction <span className="font-mono text-sky-300">{short(tracked, 5)}</span></span>
          <span className="text-zinc-400">{tx.data ? (() => { const d = decodeData(tx.data) as { deploy?: string; method?: string; args?: unknown[] }; return d.deploy ? `${walletName(tx.from)} deploys a ${d.deploy} contract` : `${walletName(tx.from)} calls SHOP.${d.method}(${d.args?.map((a) => (typeof a === "string" && a.startsWith("0x") ? walletName(a) : String(a))).join(", ")})`; })() : `${walletName(tx.from)} → ${walletName(tx.to)} · ${fmtEth(tx.value)}`} · nonce {tx.nonce} · gas price {fmtGwei(tx.gasPrice)}</span>
          <button className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300" onClick={() => setTracked(null)}>stop following</button>
        </span>
      );
      stages = [
        { title: "1 · Built", state: "done", detail: <>fields chosen by the website. Nothing is signed or sent yet.</> },
        { title: "2 · Signed", state: sig.ok ? "done" : "bad", t: app?.signedAt, detail: sig.ok ? <>sig <span className="font-mono">{short(tx.sig, 4)}</span> made by the wallet extension with the sender&apos;s private key, which never leaves it</> : <>invalid signature</> },
        { title: "3 · Sent to RPC", state: entry || app?.sentAt !== undefined ? "done" : "todo", t: entry?.t ?? app?.sentAt, detail: entry ? <><span className="font-mono">eth_sendRawTransaction</span> → {sim.nodes[entry.node].name}</> : <>waiting for the wallet to hand it over</> },
        rejected
          ? { title: "4 · Rejected", state: "bad", t: entry?.t, detail: <>{rejectReason}</> }
          : { title: "4 · In mempool", state: entry ? "done" : "todo", t: entry?.t, detail: entry ? <>node checked the signature and nonce, then queued it</> : <>—</> },
        { title: "5 · Gossiped", state: known.length >= sim.nodes.length ? "done" : known.length > 0 ? "now" : "todo", detail: <>known by {known.length}/{sim.nodes.length} nodes{events.filter((e) => e.type === "tx-received" && e.accepted).length > 1 && <> · {events.filter((e) => e.type === "tx-received" && e.accepted).map((e) => `${sim.nodes[e.node].name.split(" ")[0]} ${fmt(e.t)}`).join(", ")}</>}</> },
        { title: "6 · In a block", state: receipt ? "done" : known.length > 0 && !rejected ? "now" : "todo", t: block?.header.timestamp, detail: receipt && block ? <>block #{receipt.blockNumber} by {nodeName(block.header.proposer)}, position {receipt.index}</> : <>waiting for the next proposer to pick it{!rejected && known.length > 0 && <> · next block in {(Math.max(0, sim.nextProposalAt - sim.now) / 1000).toFixed(0)}s</>}</> },
        { title: "7 · Executed", state: receipt ? (receipt.status === "success" ? "done" : "bad") : "todo", detail: receipt ? <>{receipt.status} · fee {fmtEth(txFee(tx))} paid to {block ? nodeName(block.header.proposer) : "proposer"}{receipt.contractAddress && <> · contract created at {short(receipt.contractAddress, 4)}</>}{receipt.logs?.map((l, i) => <span key={i} className="text-violet-300"> · event {l.event}({Object.entries(l.args).map(([k, v]) => `${k}: ${typeof v === "string" && v.startsWith("0x") && v.length > 10 ? walletName(v) : v}`).join(", ")})</span>)}{receipt.error && <span className="text-rose-300"> · reverted: {receipt.error}</span>}</> : <>every node will re-run it{tx.data ? ", executing the contract code," : ""} and update {tx.data ? "storage" : "balances"}</> },
        { title: "8 · Confirmed", state: confs >= 2 ? "done" : receipt ? "now" : "todo", detail: receipt ? <>{confs} block{confs === 1 ? "" : "s"} built on top{app?.receiptAt !== undefined && <> · app fetched receipt at {fmt(app.receiptAt)}</>}. Ethereum treats it as final after ~13 min.</> : <>—</> },
      ];
    }
  }

  return (
    <div className="absolute rounded-xl border border-zinc-800 bg-zinc-900/80 backdrop-blur" style={{ left: x, top: y, width: w, height: h }}>
      <div className="border-b border-zinc-800 px-3 py-1.5 text-xs">{heading}</div>
      {stages.length > 0 && (
        <div className="relative grid grid-cols-8 gap-2 px-3 pt-3">
          <div className="absolute left-6 right-6 top-[19px] h-px bg-zinc-800" />
          {stages.map((s) => {
            const dot = { done: "bg-emerald-400", now: "bg-amber-400", todo: "bg-zinc-700", bad: "bg-rose-500" }[s.state];
            const text = { done: "text-zinc-200", now: "text-amber-200", todo: "text-zinc-600", bad: "text-rose-300" }[s.state];
            return (
              <div key={s.title} className="relative">
                <motion.div className={`relative z-10 h-3 w-3 rounded-full ring-4 ring-zinc-900 ${dot}`} animate={s.state === "now" ? { scale: [1, 1.4, 1] } : { scale: 1 }} transition={{ repeat: s.state === "now" ? Infinity : 0, duration: 1.2 }} />
                <div className={`mt-1.5 text-[11px] font-semibold ${text}`}>{s.title} {s.t !== undefined && <span className="font-mono text-[10px] font-normal text-zinc-500">{fmt(s.t)}</span>}</div>
                <div className={`mt-0.5 text-[10px] leading-snug ${s.state === "todo" ? "text-zinc-600" : "text-zinc-400"}`}>{s.detail}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
