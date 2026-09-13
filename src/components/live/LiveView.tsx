"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useLive, Flight, Hop } from "@/store/useLive";
import { short } from "@/sim/crypto";
import { Tx } from "@/sim/tx";
import { Block } from "@/sim/block";
import { Lifecycle } from "./Lifecycle";
import { FOCUS, FOCUS_ORDER, FocusId } from "./focus";
import { BrowserWallet, accountName } from "./BrowserWallet";
import { BlockDetail } from "./BlockDetail";
import { fmtEth } from "@/lib/eth";
import { decodeData } from "@/sim/contracts";

/* ---------- layout (a free field; scrolls if the window is smaller) ---------- */
const CANVAS = { w: 2400, h: 980 };
const APP = { x: 40, y: 60, w: 540, h: 350 };
const RPC = { x: 660, y: 120, w: 190, h: 210 };
const NODE = { x: 940, y: 60, w: 230, h: 350 };
const PEERS = [
  { x: 1310, y: 120 },
  { x: 1520, y: 200 },
  { x: 1350, y: 330 },
];
const PEER_R = 34;
const LIFE = { x: 40, y: 440, w: CANVAS.w - 80, h: 150 };
const BOB_RPC = { x: 1620, y: 130, w: 160, h: 112 };
const CONTRACT = { x: 1610, y: 262, w: 180, h: 150 };
const BOB = { x: 1820, y: 60, w: 540, h: 350 };
const BOB_Y = 200;
const CHAIN_Y = 650;
const BLOCK_W = 230;
const BLOCK_GAP = 50;
const BLOCK_H = 300;
const HOP_Y = 235;

const FOCUS_RECTS: Record<FocusId, { x: number; y: number; w: number; h: number }> = {
  wallet: APP,
  rpc: RPC,
  node: NODE,
  mempool: { x: NODE.x, y: NODE.y + 48, w: NODE.w, h: 240 },
  network: { x: NODE.x + NODE.w - 10, y: 60, w: 1590 - (NODE.x + NODE.w - 10), h: 370 },
  contract: CONTRACT,
  bob: { x: BOB_RPC.x - 10, y: BOB.y, w: BOB.x + BOB.w - BOB_RPC.x + 10, h: BOB.h },
  block: { x: CANVAS.w - 40 - BLOCK_W, y: CHAIN_Y - 30, w: BLOCK_W, h: BLOCK_H + 30 },
  chain: { x: 40, y: CHAIN_Y - 30, w: CANVAS.w - 80, h: BLOCK_H + 30 },
  lifecycle: LIFE,
};
const PANEL_W = 380;

const EMPTY_SET = new Set<string>();
/** Where chip i of the RPC node's mempool list sits, in canvas coordinates. Matches the Frame + list layout. */
const mempoolChipPos = (i: number) => ({ left: NODE.x + 12, top: NODE.y + 78 + i * 26, width: NODE.w - 24 });
/** Where chip j of the newest block sits, in canvas coordinates. */
const blockChipPos = (j: number) => ({ left: CANVAS.w - 40 - BLOCK_W + 8, top: CHAIN_Y + 92 + j * 22 });

const nodeCenter = (i: number) => (i === 0 ? { x: NODE.x + NODE.w, y: NODE.y + 60 } : { x: PEERS[i - 1].x, y: PEERS[i - 1].y });

const HOPS: Record<Hop, { from: [number, number]; to: [number, number] }> = {
  "app→rpc": { from: [APP.x + APP.w, HOP_Y], to: [RPC.x, HOP_Y] },
  "rpc→node": { from: [RPC.x + RPC.w, HOP_Y], to: [NODE.x, HOP_Y] },
  "node→rpc": { from: [NODE.x, HOP_Y + 22], to: [RPC.x + RPC.w, HOP_Y + 22] },
  "rpc→app": { from: [RPC.x, HOP_Y + 22], to: [APP.x + APP.w, HOP_Y + 22] },
  "bob→rpc2": { from: [BOB.x, BOB_Y], to: [BOB_RPC.x + BOB_RPC.w, BOB_Y] },
  "rpc2→node2": { from: [BOB_RPC.x, BOB_Y], to: [PEERS[1].x + PEER_R, BOB_Y] },
  "node2→rpc2": { from: [PEERS[1].x + PEER_R, BOB_Y + 22], to: [BOB_RPC.x, BOB_Y + 22] },
  "rpc2→bob": { from: [BOB_RPC.x + BOB_RPC.w, BOB_Y + 22], to: [BOB.x, BOB_Y + 22] },
};

const WALLET_COLORS = ["bg-sky-500/25 text-sky-200 border-sky-500/40", "bg-violet-500/20 text-violet-200 border-violet-500/40", "bg-teal-500/20 text-teal-200 border-teal-500/40", "bg-pink-500/20 text-pink-200 border-pink-500/40", "bg-lime-500/20 text-lime-200 border-lime-500/40"];

/* ---------- runner: sim clock + app polling ---------- */
function Runner() {
  const tick = useLive((s) => s.tick);
  const poll = useLive((s) => s.poll);
  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const { running, speed } = useLive.getState();
      const dt = Math.min(100, t - last);
      last = t;
      if (running) tick(dt * speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    let pollTimer = 0;
    const schedulePoll = () => { pollTimer = window.setTimeout(() => { const st = useLive.getState(); if (st.running) poll(); schedulePoll(); }, 2500 / useLive.getState().speed); };
    schedulePoll();
    return () => { cancelAnimationFrame(raf); clearTimeout(pollTimer); };
  }, [tick, poll]);
  return null;
}

/* ---------- pieces ---------- */
function Frame({ x, y, w, h, title, subtitle, children, accent = "zinc" }: { x: number; y: number; w: number; h?: number; title: string; subtitle?: string; children: React.ReactNode; accent?: "zinc" | "sky" | "amber" | "emerald" }) {
  const ring = { zinc: "border-zinc-700", sky: "border-sky-500/60", amber: "border-amber-500/60", emerald: "border-emerald-500/60" }[accent];
  return (
    <div className={`absolute flex flex-col rounded-xl border ${ring} bg-zinc-900/90 shadow-xl backdrop-blur`} style={{ left: x, top: y, width: w, height: h }}>
      <div className="border-b border-zinc-800 px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</div>
        {subtitle && <div className="text-[10px] text-zinc-500">{subtitle}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3">{children}</div>
    </div>
  );
}

function TxChip({ tx, walletIdx, small = false, appear = false }: { tx: Tx; walletIdx: (a: string) => number; small?: boolean; appear?: boolean }) {
  const tracked = useLive((s) => s.tracked);
  const setTracked = useLive((s) => s.setTracked);
  const isTracked = tracked === tx.hash;
  const f = walletIdx(tx.from), t = walletIdx(tx.to);
  const name = (i: number) => (i === 0 ? "you" : i === 1 ? "bob" : i < 0 ? "?" : `w${i}`);
  const call = tx.data ? (decodeData(tx.data) as { deploy?: string; method?: string; args?: unknown[] }) : null;
  return (
    <motion.div initial={appear ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={appear ? { delay: 0.85, duration: 0.2 } : undefined}
      onClick={() => setTracked(tx.hash)}
      className={`flex cursor-pointer items-center gap-1 rounded border px-1.5 ${small ? "py-px text-[10px]" : "py-0.5 text-[11px]"} font-mono ${call ? "border-violet-400/60 bg-violet-500/25 text-violet-100" : WALLET_COLORS[Math.max(0, f) % WALLET_COLORS.length]} ${isTracked ? "tx-glow relative z-10" : ""}`}>
      {call ? (
        <span className="truncate">{name(f)}→{call.deploy ? "new contract" : "SHOP"} <span className="opacity-80">{call.deploy ? `deploy ${call.deploy}` : `${call.method}(${call.args?.map((a) => (typeof a === "string" && a.startsWith("0x") ? name(walletIdx(a)) : String(a))).join(", ")})`}</span></span>
      ) : (<>
      <span>{name(f)}→{name(t)}</span>
      <span className="opacity-90">{fmtEth(tx.value, { unit: false })}</span></>)}
      <span className="ml-auto opacity-50">{short(tx.hash, 2)}</span>
    </motion.div>
  );
}

function FlightChip({ f, onDone }: { f: Flight; onDone: () => void }) {
  const h = HOPS[f.hop];
  const cls = f.kind === "req" ? "bg-sky-500 text-zinc-950" : f.kind === "res" ? "bg-emerald-500 text-zinc-950" : "bg-zinc-700 text-zinc-300";
  return (
    <motion.div className={`absolute z-20 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] shadow ${cls}`}
      initial={{ left: h.from[0], top: h.from[1], opacity: 0 }} animate={{ left: h.to[0], top: h.to[1], opacity: 1 }}
      transition={{ duration: f.ms / 1000, ease: "linear" }} onAnimationComplete={onDone}
      style={{ transform: h.to[0] > h.from[0] ? "translate(-100%, -50%)" : "translate(0, -50%)", marginTop: f.kind === "poll" ? (f.hop === "app→rpc" || f.hop === "bob→rpc2" ? -20 : 20) : 0 }}>
      {f.label}
    </motion.div>
  );
}

function BlockCard({ b, i, total, walletIdx, proposerName, depth, onSelect, selected, flew }: { b: Block; i: number; total: number; walletIdx: (a: string) => number; proposerName: string; depth: number; onSelect: () => void; selected: boolean; flew: Set<string> }) {
  const fees = b.receipts.reduce((s, r) => s + r.fee, 0);
  // newest block sits at the far right; older ones slide left as new ones arrive
  const x = CANVAS.w - 40 - BLOCK_W - (total - 1 - i) * (BLOCK_W + BLOCK_GAP);
  return (
    <motion.div initial={{ opacity: 0, y: 40, scale: 0.9, left: x }} animate={{ opacity: 1, y: 0, scale: 1, left: x }} exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16 }}
      className={`absolute flex flex-col rounded-xl border bg-zinc-900/90 shadow-xl ${selected ? "border-white" : i === total - 1 ? "border-amber-400" : "border-amber-500/30"}`}
      style={{ top: CHAIN_Y, width: BLOCK_W, height: BLOCK_H }}>
      <div className="cursor-pointer border-b border-zinc-800 px-3 py-2 hover:bg-zinc-800/50" onClick={onSelect} title="click for what this block changed">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-semibold text-amber-300">Block #{b.header.number}</span>
          <span className={`rounded px-1.5 py-px text-[10px] ${depth === 0 ? "bg-amber-500/20 text-amber-300" : depth < 3 ? "bg-zinc-800 text-zinc-400" : "bg-emerald-500/15 text-emerald-300"}`}>{depth === 0 ? "newest" : `${depth} deep`}</span>
        </div>
        <div className="font-mono text-[10px] text-zinc-400">hash {short(b.hash, 6)}</div>
        <div className="font-mono text-[10px] text-zinc-600">prev {short(b.header.parentHash, 6)}</div>
        <div className="flex justify-between text-[10px] text-zinc-500"><span>by {proposerName}</span><span>{b.txs.length} tx{fees > 0 && <span className="text-amber-400/80"> · fees {fmtEth(fees)}</span>}</span></div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-2">
        {b.txs.length === 0 && <div className="text-[11px] text-zinc-600">no transactions</div>}
        {b.txs.map((tx, j) => (
          <div key={tx.hash} className="flex items-center gap-1">
            <TxChip tx={tx} walletIdx={walletIdx} small appear={flew.has(tx.hash)} />
            <span className={`text-[9px] ${b.receipts[j]?.status === "success" ? "text-emerald-400" : "text-rose-400"}`}>{b.receipts[j]?.status === "success" ? "✓" : "✗"}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- the page ---------- */
export function LiveView() {
  useLive((s) => s.version);
  const { sim, running, speed, setSpeed, traffic, rpcNode, tracked, flights, lastRpc, lastRpcBob, lastApplied, tokenAddr, setRunning, setTraffic, removeFlight, reset } = useLive();
  const accountLabel = (a: string) => accountName(sim, a) ?? short(a, 3);
  const flewSet = new Set((lastApplied?.entries ?? []).filter((e) => e.mempoolIdx !== null).map((e) => e.hash));
  const [focus, setFocusState] = useState<FocusId | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  // Camera: canvas → screen is translate(x, y) scale(s). Trackpad pans, pinch/ctrl+wheel zooms, drag pans.
  const [view, setView] = useState({ x: 0, y: 0, s: 1 });
  const [animated, setAnimated] = useState(false);
  const preFocus = useRef<{ x: number; y: number; s: number } | null>(null);
  const changeFocusRef = useRef<(id: FocusId | null) => void>(() => {});
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const MIN_S = 0.3, MAX_S = 3;

  const fit = (w: number, h: number) => {
    const s = Math.min(1, (w - 40) / CANVAS.w, (h - 20) / CANVAS.h);
    return { s, x: Math.max(0, (w - CANVAS.w * s) / 2), y: 10 };
  };
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      setVp({ w: el.clientWidth, h: el.clientHeight });
      if (first) { first = false; setView(fit(el.clientWidth, el.clientHeight)); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setAnimated(false);
      if (focus) { changeFocusRef.current(null); }
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      setView((v) => {
        if (e.ctrlKey || e.metaKey) {
          // pinch / ctrl+wheel: zoom around the cursor
          const factor = Math.exp(-e.deltaY * 0.01);
          const s = Math.min(MAX_S, Math.max(MIN_S, v.s * factor));
          const k = s / v.s;
          return { s, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
        }
        // two-finger scroll: pan
        return { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [focus]);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a, [data-nopan]")) return;
    if (e.button !== 0) return;
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setAnimated(false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const d = drag.current;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.px), y: d.vy + (e.clientY - d.py) }));
  };
  const onPointerUp = () => { drag.current = null; setDragging(false); };
  const zoomBy = (factor: number) => {
    setAnimated(true);
    setView((v) => {
      const s = Math.min(MAX_S, Math.max(MIN_S, v.s * factor));
      const k = s / v.s;
      const cx = vp.w / 2, cy = vp.h / 2;
      return { s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { changeFocusRef.current(null); setSelectedBlock(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Focus drives the camera while active; leaving focus restores where you were.
  const focusCamera = (id: FocusId) => {
    const r = FOCUS_RECTS[id];
    const availW = Math.max(300, vp.w - PANEL_W - 60), availH = Math.max(300, vp.h - 60);
    const sc = Math.max(0.5, Math.min(1.8, availW / r.w, availH / r.h));
    return { s: sc, x: 30 + availW / 2 - (r.x + r.w / 2) * sc, y: 30 + availH / 2 - (r.y + r.h / 2) * sc };
  };
  const changeFocus = (id: FocusId | null) => {
    setAnimated(true);
    if (id && !focus) preFocus.current = view;
    if (!id && preFocus.current) { setView(preFocus.current); preFocus.current = null; }
    setFocusState(id);
  };
  const cam = focus ? focusCamera(focus) : view;
  useEffect(() => { changeFocusRef.current = changeFocus; });
  const zoom = { transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})` };
  const focusInfo = focus ? FOCUS[focus] : null;
  const nextFocus = focus ? FOCUS_ORDER[(FOCUS_ORDER.indexOf(focus) + 1) % FOCUS_ORDER.length] : null;
  const node = sim.nodes[rpcNode];
  const walletIdx = (a: string) => sim.accounts.findIndex((k) => k.address === a);
  const proposerName = (a: string) => sim.nodes.find((n) => n.address === a)?.name ?? short(a);
  const blocks = node.chain.slice(-7);
  const mempool = [...node.mempool.values()].sort((a, b) => b.gasPrice - a.gasPrice || a.nonce - b.nonce);
  const untilNext = Math.max(0, sim.nextProposalAt - sim.now);
  const proposer = sim.currentProposer();

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <Runner />
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-2 text-xs">
        <span className="text-sm font-semibold">A blockchain, live</span>
        <span className="text-zinc-500">Everything below is really happening in your browser: real signatures, real hashes, a toy network of 4 nodes, two users on two different RPCs, a smart contract, one block every 12 seconds like Ethereum.</span>
        <span className="ml-auto flex items-center gap-2">
          <button className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800" onClick={() => setRunning(!running)}>{running ? "⏸ pause" : "▶ play"}</button>
          <span className="ml-1 text-zinc-500">speed</span>
          {[0.25, 0.5, 1, 2, 4].map((sp) => (
            <button key={sp} className={`rounded border px-2 py-1 hover:bg-zinc-800 ${speed === sp ? "border-sky-500 text-sky-300" : "border-zinc-700"}`} onClick={() => setSpeed(sp)}>{sp}×</button>
          ))}
          <button className={`rounded border px-2 py-1 hover:bg-zinc-800 ${traffic ? "border-zinc-500" : "border-zinc-800 text-zinc-500"}`} onClick={() => setTraffic(!traffic)}>other users: {traffic ? "on" : "off"}</button>
          <button className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800" onClick={reset}>↺ restart</button>
          <Link href="/learn/hash" className="text-zinc-500 hover:text-zinc-300">lessons</Link>
          <Link href="/playground" className="text-zinc-500 hover:text-zinc-300">inspector</Link>
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 px-4 py-1.5 text-xs">
        <span className="mr-1 text-zinc-500">focus on</span>
        {FOCUS_ORDER.map((id) => (
          <button key={id} onClick={() => changeFocus(focus === id ? null : id)} className={`rounded px-2 py-0.5 ${focus === id ? "bg-amber-500/20 text-amber-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>{FOCUS[id].label}</button>
        ))}
        {focus && <button onClick={() => changeFocus(null)} className="ml-2 text-zinc-500 hover:text-zinc-300">✕ show everything (Esc)</button>}
        <span className="ml-auto flex items-center gap-1 text-zinc-500">
          <span className="mr-1 hidden text-[10px] sm:inline">scroll to pan · pinch or ctrl+scroll to zoom · drag to move</span>
          <button className="rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800" onClick={() => zoomBy(1 / 1.25)}>−</button>
          <span className="w-10 text-center font-mono text-[10px] text-zinc-400">{Math.round(cam.s * 100)}%</span>
          <button className="rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800" onClick={() => zoomBy(1.25)}>+</button>
          <button className="rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800" onClick={() => { changeFocus(null); setAnimated(true); setView(fit(vp.w, vp.h)); }}>fit</button>
        </span>
      </div>

      <div ref={viewport} className="relative min-h-0 flex-1 touch-none overflow-hidden select-none" style={{ cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className={`relative origin-top-left ${animated ? "transition-transform duration-700 ease-in-out" : ""}`} style={{ width: CANVAS.w, height: CANVAS.h, ...zoom }}>
            {/* wires */}
            <svg className="absolute inset-0" width={CANVAS.w} height={CANVAS.h}>
              <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#52525b" /></marker></defs>
              {(Object.keys(HOPS) as Hop[]).map((h) => (
                <line key={h} x1={HOPS[h].from[0]} y1={HOPS[h].from[1]} x2={HOPS[h].to[0]} y2={HOPS[h].to[1]} stroke="#3f3f46" strokeWidth={1.5} markerEnd="url(#arr)" />
              ))}
              <text x={(APP.x + APP.w + RPC.x) / 2} y={HOP_Y - 12} fill="#71717a" fontSize={10} textAnchor="middle">JSON-RPC</text>
              <text x={(APP.x + APP.w + RPC.x) / 2} y={HOP_Y + 62} fill="#71717a" fontSize={9} textAnchor="middle">reading is free ·</text>
              <text x={(APP.x + APP.w + RPC.x) / 2} y={HOP_Y + 74} fill="#71717a" fontSize={9} textAnchor="middle">sending costs gas</text>
              <text x={(RPC.x + RPC.w + NODE.x) / 2} y={HOP_Y - 12} fill="#71717a" fontSize={10} textAnchor="middle">reads node</text>
              <text x={(BOB_RPC.x + BOB_RPC.w + BOB.x) / 2} y={BOB_Y - 12} fill="#71717a" fontSize={10} textAnchor="middle">JSON-RPC</text>
              <text x={(PEERS[1].x + PEER_R + BOB_RPC.x) / 2} y={BOB_Y - 12} fill="#71717a" fontSize={10} textAnchor="middle">reads node</text>
              {/* p2p links */}
              {sim.nodes.map((n) => n.peers.filter((p) => n.id < p).map((p) => {
                const a = nodeCenter(n.id), b = nodeCenter(p);
                return <line key={`${n.id}-${p}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3f3f46" strokeDasharray="3 3" />;
              }))}
              <text x={1010} y={412} fill="#71717a" fontSize={10} textAnchor="middle">peer-to-peer gossip</text>
              {/* gossip in flight */}
              {sim.inflight().map((m) => {
                const a = nodeCenter(m.from), b = nodeCenter(m.to);
                const p = Math.min(1, (sim.now - m.sentAt) / (m.deliverAt - m.sentAt));
                const x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p;
                const isTracked = m.kind === "tx" && (m.payload as Tx).hash === tracked;
                return m.kind === "block" ? <rect key={m.id} x={x - 5} y={y - 5} width={10} height={10} rx={2} fill="#f59e0b" /> : <circle key={m.id} cx={x} cy={y} r={isTracked ? 6 : 3.5} fill={isTracked ? "#ffffff" : "#38bdf8"} className={isTracked ? "dot-glow" : undefined} />;
              })}
              {/* peers */}
              {PEERS.map((p, i) => {
                const n = sim.nodes[i + 1];
                const isProp = proposer?.id === n.id;
                return (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={PEER_R} fill="#18181b" stroke={isProp ? "#f59e0b" : "#10b981"} strokeWidth={2} />
                    <text x={p.x} y={p.y - 4} fill="#e4e4e7" fontSize={12} textAnchor="middle" fontWeight={600}>#{n.head().header.number}</text>
                    <text x={p.x} y={p.y + 10} fill="#a1a1aa" fontSize={9} textAnchor="middle">{n.mempool.size} pending</text>
                    <text x={p.x} y={p.y + PEER_R + 14} fill="#a1a1aa" fontSize={10} textAnchor="middle">{n.name}{isProp ? " · proposing next" : ""}</text>
                    <text x={p.x} y={p.y + PEER_R + 26} fill="#f59e0b" fillOpacity={0.8} fontSize={9} textAnchor="middle">earned {fmtEth(n.state.get(n.address).balance)} in fees</text>
                  </g>
                );
              })}
              {/* node → chain */}
              <path d={`M ${NODE.x + NODE.w} ${NODE.y + NODE.h - 20} C ${CANVAS.w - 20} ${NODE.y + NODE.h}, ${CANVAS.w - 20} ${CHAIN_Y - 60}, ${CANVAS.w - 40 - BLOCK_W / 2} ${CHAIN_Y}`} fill="none" stroke="#f59e0b" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 4" />
              <text x={CANVAS.w - 40 - BLOCK_W / 2} y={CHAIN_Y - 14} fill="#f59e0b" fontSize={10} textAnchor="middle">
                next block in {(untilNext / 1000).toFixed(1)}s · proposer: {proposer?.name}
              </text>
              <text x={40} y={CHAIN_Y - 14} fill="#71717a" fontSize={11}>THE CHAIN · every node holds this same list · newest on the right</text>
              <line x1={40} y1={CHAIN_Y - 6} x2={CANVAS.w - 40} y2={CHAIN_Y - 6} stroke="#27272a" />
            </svg>

            {/* App: a website open in a browser, with a wallet extension */}
            <BrowserWallet {...APP} owner="you" />

            {/* Bob: another person, another RPC, another node */}
            <Frame {...BOB_RPC} title="Another RPC" subtitle={`attached to ${sim.nodes[useLive.getState().bobNode].name}`} accent="emerald">
              <div className="text-[10px] text-zinc-500">Different provider, different node, same chain.</div>
              {lastRpcBob && <div className="mt-1 truncate font-mono text-[10px] text-sky-300">→ {lastRpcBob.method}</div>}
            </Frame>
            <BrowserWallet {...BOB} owner="bob" />

            {/* the smart contract, as stored by every node */}
            <Frame {...CONTRACT} title="Smart contract" subtitle={tokenAddr ? `SHOP token · ${short(tokenAddr, 4)}` : "none deployed yet"} accent={tokenAddr ? "amber" : "zinc"}>
              {tokenAddr ? (() => {
                const acct = node.state.get(tokenAddr);
                const bal = (acct.storage as { balances?: Record<string, number>; totalSupply?: number } | undefined)?.balances ?? {};
                const rows = Object.entries(bal).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
                return (
                  <div className="text-[10px]">
                    <div className="text-zinc-500">code <span className="font-mono text-violet-300">Token {"{ transfer, balanceOf }"}</span></div>
                    <div className="mt-1 text-zinc-500">storage <span className="text-zinc-600">(same on every node)</span></div>
                    <table className="mt-0.5 w-full font-mono">
                      <tbody>{rows.map(([a, v]) => <tr key={a}><td className="text-zinc-300">{accountLabel(a)}</td><td className="text-right text-violet-200">{v} SHOP</td></tr>)}</tbody>
                    </table>
                  </div>
                );
              })() : <div className="text-[10px] text-zinc-500">A contract is a program stored at an address. Bob can deploy one from his shop.</div>}
            </Frame>

            {/* RPC */}
            <Frame {...RPC} title="RPC endpoint" subtitle={`attached to ${node.name}`} accent="emerald">
              <div className="text-[10px] text-zinc-500">An RPC is just a server that answers questions by reading one node&apos;s data. Apps never talk to the network directly.</div>
              {lastRpc && (
                <div className="mt-2 rounded bg-zinc-950 p-2 font-mono text-[10px]">
                  <div className="text-sky-300">→ {lastRpc.method}</div>
                  <div className="truncate text-zinc-500">{JSON.stringify(lastRpc.params)}</div>
                  <div className={`mt-1 break-all ${(lastRpc.response as { error?: unknown }).error ? "text-rose-300" : "text-emerald-300"}`}>← {JSON.stringify(lastRpc.response).slice(0, 90)}</div>
                </div>
              )}
            </Frame>

            {/* Node */}
            <Frame {...NODE} title={node.name} subtitle={`full node · head #${node.head().header.number} · ${node.peers.length} peers`} accent={proposer?.id === node.id ? "amber" : "zinc"}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-zinc-400">mempool <span className="text-zinc-600">(waiting for a block)</span></span>
                <span className="font-mono text-zinc-500">{mempool.length}</span>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {mempool.length === 0 && <div className="text-[11px] text-zinc-600">empty</div>}
                {mempool.slice(0, 9).map((tx) => <TxChip key={tx.hash} tx={tx} walletIdx={walletIdx} />)}
                {mempool.length > 9 && <div className="text-[10px] text-zinc-600">+{mempool.length - 9} more</div>}
              </div>
              <div className="mt-3 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
                state root <span className="font-mono text-zinc-400">{short(node.state.root(), 5)}</span>
                <div className="mt-0.5 text-amber-400/80">earned {fmtEth(node.state.get(node.address).balance)} in fees so far</div>
                {proposer?.id === node.id && <div className="mt-1 text-amber-300">this node proposes the next block</div>}
              </div>
            </Frame>

            <Lifecycle {...LIFE} />

            {/* chips flying from the mempool into the newest block, in canvas coordinates */}
            {lastApplied?.entries.filter((e) => e.mempoolIdx !== null).map((e) => {
              const tx = node.txIndex.get(e.hash);
              if (!tx) return null;
              const from = mempoolChipPos(e.mempoolIdx!), to = blockChipPos(e.blockIdx);
              return (
                <motion.div key={`${lastApplied.blockHash}-${e.hash}`} className="pointer-events-none absolute z-20" style={{ width: from.width }}
                  initial={{ left: from.left, top: from.top, opacity: 1, scale: 1 }}
                  animate={{ left: to.left, top: to.top, opacity: [1, 1, 0], scale: 0.85 }}
                  transition={{ duration: 0.9, ease: "easeInOut", opacity: { duration: 1.0, times: [0, 0.9, 1] } }}>
                  <TxChip tx={tx} walletIdx={walletIdx} />
                </motion.div>
              );
            })}

            {/* flights along wires */}
            <AnimatePresence>
              {flights.map((f) => <FlightChip key={f.id} f={f} onDone={() => removeFlight(f.id)} />)}
            </AnimatePresence>

            {/* chain */}
            <AnimatePresence>
              {blocks.map((b, i) => <BlockCard key={b.hash} b={b} i={i} total={blocks.length} walletIdx={walletIdx} proposerName={proposerName(b.header.proposer)} depth={node.head().header.number - b.header.number} flew={lastApplied?.blockHash === b.hash ? flewSet : EMPTY_SET} selected={selectedBlock === b.hash} onSelect={() => { setSelectedBlock(selectedBlock === b.hash ? null : b.hash); changeFocus(null); }} />)}
            </AnimatePresence>
            {/* focus mask */}
            <AnimatePresence>
              {focus && (() => { const r = FOCUS_RECTS[focus]; const pad = 10; return (
                <motion.svg key="mask" className="pointer-events-none absolute inset-0 z-30" width={CANVAS.w} height={CANVAS.h} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <path fillRule="evenodd" fill="#09090b" fillOpacity={0.8} d={`M0 0 H${CANVAS.w} V${CANVAS.h} H0 Z M${r.x - pad} ${r.y - pad} h${r.w + 2 * pad} v${r.h + 2 * pad} h${-(r.w + 2 * pad)} Z`} />
                  <rect x={r.x - pad} y={r.y - pad} width={r.w + 2 * pad} height={r.h + 2 * pad} rx={14} fill="none" stroke="#f59e0b" strokeWidth={2} />
                </motion.svg>
              ); })()}
            </AnimatePresence>
          </div>

        {/* block detail panel */}
        <AnimatePresence>
          {!focus && selectedBlock && (() => { const b = node.chain.find((x) => x.hash === selectedBlock); return b ? <BlockDetail key={b.hash} block={b} width={PANEL_W} onClose={() => setSelectedBlock(null)} /> : null; })()}
        </AnimatePresence>

        {/* explanation panel */}
        <AnimatePresence>
          {focusInfo && (
            <motion.aside key={focusInfo.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.3 }}
              data-nopan className="absolute right-0 top-0 z-40 flex h-full flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950/95 p-5 backdrop-blur" style={{ width: PANEL_W }}>
              <div className="text-[11px] uppercase tracking-wider text-amber-400">focus · {focusInfo.label}</div>
              <h2 className="mt-1 text-xl font-semibold text-zinc-100">{focusInfo.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-300 [&_b]:text-zinc-100">{focusInfo.body}</div>
              <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Watch for</h3>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-zinc-300">{focusInfo.watch.map((w) => <li key={w}>{w}</li>)}</ul>
              <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">On Ethereum</h3>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-zinc-400">{focusInfo.ethereum.map((w) => <li key={w}>{w}</li>)}</ul>
              <div className="mt-auto flex items-center justify-between pt-6 text-sm">
                <button className="text-zinc-500 hover:text-zinc-300" onClick={() => changeFocus(null)}>show everything</button>
                {nextFocus && <button className="rounded bg-amber-500 px-3 py-1.5 font-medium text-zinc-950 hover:bg-amber-400" onClick={() => changeFocus(nextFocus)}>Next: {FOCUS[nextFocus].label} →</button>}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
