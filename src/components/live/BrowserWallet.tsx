"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLive, Owner } from "@/store/useLive";
import { short, keypairFromPriv, keccak, fromHex } from "@/sim/crypto";
import { GAS_PER_TX, GAS_CALL, GAS_DEPLOY } from "@/sim/tx";
import { fmtEth, fmtGwei, parseEth } from "@/lib/eth";

const GAS_PRICE = 2;

export function accountName(sim: { accounts: { address: string }[] }, a: string, style: "short" | "long" = "short") {
  const i = sim.accounts.findIndex((k) => k.address === a);
  if (i === 0) return "you";
  if (i === 1) return "Bob";
  if (i > 1) return style === "short" ? `w${i}` : `wallet ${i}`;
  return null;
}

/** Deterministic little avatar from an address, like the identicons wallets show. */
function Identicon({ address, size = 18 }: { address: string; size?: number }) {
  const h = parseInt(address.slice(2, 8), 16);
  const a = h % 360, b = (h * 7) % 360;
  return <span className="inline-block shrink-0 rounded-full ring-1 ring-black/10" style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${a} 70% 60%), hsl(${b} 70% 45%))` }} />;
}

const BRAND: Record<Owner, { site: string; name: string; logo: string; nav: string[]; primary: string; primaryHover: string; accentText: string; accentBg: string; heading: string; sendLabel: string; balanceLabel: string }> = {
  you: { site: "pay.example.app", name: "Pay", logo: "◈", nav: ["Send", "Activity"], primary: "bg-indigo-600", primaryHover: "hover:bg-indigo-500", accentText: "text-indigo-600", accentBg: "bg-indigo-50", heading: "Send money", sendLabel: "Review & send", balanceLabel: "Your balance" },
  bob: { site: "bobs-shop.example", name: "Bob's Shop", logo: "☕", nav: ["Dashboard", "Loyalty"], primary: "bg-emerald-600", primaryHover: "hover:bg-emerald-500", accentText: "text-emerald-700", accentBg: "bg-emerald-50", heading: "Send a payout", sendLabel: "Review & send", balanceLabel: "Shop balance" },
};

/** A browser window with a real-looking web app inside and a wallet extension popup. Used for you (left) and Bob (right). */
export function BrowserWallet({ x, y, w, h, owner }: { x: number; y: number; w: number; h: number; owner: Owner; compact?: boolean }) {
  useLive((s) => s.version);
  const st = useLive();
  const { sim, tracked, setTracked, send, speed, tokenAddr, tokenBalances, deployToken, sendToken } = st;
  const brand = BRAND[owner];
  const acctIdx = owner === "you" ? 0 : st.bobAccount;
  const nodeId = owner === "you" ? st.rpcNode : st.bobNode;
  const balance = owner === "you" ? st.balance : st.bobBalance;
  const blockNumber = owner === "you" ? st.blockNumber : st.bobBlockNumber;
  const tokenBal = tokenBalances[owner];
  const appTxs = st.appTxs.filter((t) => t.owner === owner);
  const toasts = st.incoming.filter((t) => t.owner === owner);
  const [to, setTo] = useState(owner === "you" ? 1 : 0);
  const [asset, setAsset] = useState<"ETH" | "SHOP">("ETH");
  const [amount, setAmount] = useState(owner === "you" ? "0.1" : "0.05");
  const [popup, setPopup] = useState<"closed" | "confirm" | "confirm-token" | "confirm-deploy" | "signing" | "account">("closed");
  const me = sim.accounts[acctIdx];
  const value = parseEth(amount);
  const tokenAmount = Math.max(0, Math.floor(parseFloat(amount) || 0));
  const fee = GAS_PER_TX * GAS_PRICE;
  const nonceRes = sim.rpc(nodeId, { method: "eth_getTransactionCount", params: [me.address, "pending"] });
  const nonce = nonceRes.result ? parseInt(nonceRes.result as string, 16) : 0;
  const label = (a: string) => accountName(sim, a, "long") ?? short(a, 3);
  const pendingDeploy = st.appTxs.some((t) => t.label?.startsWith("deploy") && t.status !== "mined" && t.status !== "rejected");
  const useShop = asset === "SHOP" && !!tokenAddr;

  const review = () => setPopup(useShop ? "confirm-token" : "confirm");
  const confirm = async () => {
    const mode = popup;
    setPopup("signing");
    setTimeout(() => setPopup("closed"), 900 / speed);
    if (mode === "confirm-deploy") await deployToken();
    else if (mode === "confirm-token") await sendToken(to, tokenAmount, owner);
    else await send(to, value, owner);
  };
  const switchAsset = (a: "ETH" | "SHOP") => { setAsset(a); setAmount(a === "ETH" ? (owner === "you" ? "0.1" : "0.05") : (owner === "you" ? "10" : "50")); };

  const statusPill = (t: (typeof appTxs)[number]) => {
    const dropped = t.status === "rejected" && t.error?.startsWith("dropped");
    const cls = t.status === "mined" ? "bg-emerald-100 text-emerald-700" : t.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700";
    const text = t.status === "mined" ? `Confirmed · block ${t.block}` : dropped ? "Dropped" : t.status === "rejected" ? "Rejected" : t.status === "pending" ? "Pending" : t.status === "sent" ? "Broadcasting" : "Signing";
    return <span className={`shrink-0 rounded-full px-2 py-px text-[9px] font-medium ${cls}`}>{text}</span>;
  };

  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: h }}>
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-700 bg-white text-slate-800 shadow-2xl">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-zinc-700 bg-zinc-800 px-3 py-1.5">
          <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" /><i className="h-2.5 w-2.5 rounded-full bg-amber-400" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          <span className="ml-1 flex gap-2 text-[10px] text-zinc-500"><span>‹</span><span>›</span><span>↻</span></span>
          <div className="flex flex-1 items-center gap-1.5 truncate rounded-md bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300"><span className="text-emerald-400">🔒</span> https://{brand.site}</div>
          <button title="Wallet extension: my account" onClick={() => setPopup(popup === "closed" ? "account" : "closed")} className="rounded px-1 text-sm hover:bg-zinc-700">🦊</button>
        </div>

        {/* site nav */}
        <div className="flex items-center gap-4 border-b border-slate-200 px-4 py-2">
          <span className={`flex items-center gap-1.5 text-sm font-bold ${brand.accentText}`}><span>{brand.logo}</span>{brand.name}</span>
          <nav className="flex gap-3 text-[11px] text-slate-500">{brand.nav.map((n, i) => <span key={n} className={i === 0 ? "font-medium text-slate-900" : ""}>{n}</span>)}</nav>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Ethereum</span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-700"><Identicon address={me.address} size={12} />{short(me.address, 3)}</span>
          </span>
        </div>

        {/* page */}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,11fr)_minmax(0,9fr)] gap-3 p-3">
          <div className="flex min-h-0 flex-col gap-2">
            {/* balance card */}
            <div className={`rounded-lg ${brand.accentBg} px-3 py-2`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{brand.balanceLabel}</span>
                <span className="text-[9px] text-slate-400">as of block {blockNumber}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <motion.span key={balance} initial={{ scale: 1.08 }} animate={{ scale: 1 }} className="whitespace-nowrap font-mono text-xl font-semibold text-slate-900">{fmtEth(balance)}</motion.span>
                {tokenAddr && <span className="whitespace-nowrap font-mono text-xs text-violet-700">{tokenBal ?? "…"} SHOP</span>}
              </div>
            </div>
            {/* send form */}
            <div className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">{brand.heading}</span>
                {tokenAddr && (
                  <span className="flex rounded-md bg-slate-100 p-0.5 text-[10px]">
                    {(["ETH", "SHOP"] as const).map((a) => <button key={a} onClick={() => switchAsset(a)} className={`rounded px-1.5 py-px ${asset === a ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500"}`}>{a}</button>)}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                <span className="text-[10px] text-slate-400">To</span>
                <Identicon address={sim.accounts[to].address} size={14} />
                <select className="min-w-0 flex-1 truncate bg-transparent font-mono text-[11px] text-slate-800 outline-none" value={to} onChange={(e) => setTo(+e.target.value)}>
                  {sim.accounts.map((k, i) => i !== acctIdx && <option key={k.address} value={i}>{label(k.address)} · {short(k.address, 4)}</option>)}
                </select>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                <span className="text-[10px] text-slate-400">Amount</span>
                <input className="min-w-0 flex-1 bg-transparent font-mono text-sm text-slate-900 outline-none" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <span className="text-[10px] font-medium text-slate-500">{useShop ? "SHOP" : "ETH"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
                <span>Network fee ≈ {fmtEth((useShop ? GAS_CALL : GAS_PER_TX) * GAS_PRICE)}</span>
                <span>{useShop ? "contract call" : "transfer"}</span>
              </div>
              <button className={`mt-1.5 w-full rounded-md ${brand.primary} ${brand.primaryHover} py-1.5 text-xs font-semibold text-white disabled:opacity-50`} disabled={popup !== "closed"} onClick={review}>{brand.sendLabel}</button>
            </div>
            {/* Bob: loyalty token deployment */}
            {owner === "bob" && !tokenAddr && (
              <button className="rounded-lg border border-dashed border-violet-300 bg-violet-50 px-3 py-1.5 text-left text-[11px] text-violet-800 hover:bg-violet-100 disabled:opacity-50" disabled={popup !== "closed" || pendingDeploy} onClick={() => setPopup("confirm-deploy")}>
                <span className="font-semibold">{pendingDeploy ? "Deploying loyalty token…" : "Launch a loyalty token"}</span>
                <span className="block text-[10px] text-violet-600">{pendingDeploy ? "waiting for the next block" : "Deploys a SHOP token contract. Reward customers with points."}</span>
              </button>
            )}
          </div>

          {/* activity */}
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-900">Activity</span><span className="text-[9px] text-slate-400">live</span></div>
            <div className="mt-1 min-h-0 flex-1 space-y-1 overflow-hidden">
              <AnimatePresence>
                {toasts.map((t) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">↓</span>
                    <span className="min-w-0 flex-1 truncate">Received <b>{fmtEth(t.value)}</b> from {label(t.from)}</span>
                    <span className="shrink-0 text-emerald-600">block {t.block}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {appTxs.length === 0 && toasts.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-200 p-3 text-center text-[10px] text-slate-400">
                  {owner === "you" ? "No transactions yet. Send something and watch it travel." : "Nothing yet. Send a payout, or launch a loyalty token."}
                </div>
              )}
              {appTxs.map((t) => {
                const isContract = !!t.tx.data;
                return (
                  <div key={t.hash} onClick={() => setTracked(t.hash)} title={t.error} className={`flex cursor-pointer items-center gap-2 rounded-md border border-slate-100 px-2 py-1 text-[10px] hover:bg-slate-50 ${tracked === t.hash ? "tx-glow" : ""}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isContract ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{isContract ? "⚙" : "↑"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-800">{t.label ?? `Sent ${fmtEth(t.value)} to ${label(sim.accounts[t.to].address)}`}</span>
                      <span className="block truncate text-[9px] text-slate-400">nonce {t.tx.nonce}{t.fee ? ` · fee ${fmtEth(t.fee)}` : ""} · {short(t.hash, 3)}</span>
                    </span>
                    {statusPill(t)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* wallet extension popup */}
      <AnimatePresence>
        {popup !== "closed" && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.18 }}
            className="absolute z-50 overflow-hidden rounded-xl border border-orange-500/50 bg-zinc-950 text-zinc-100 shadow-2xl" style={{ right: 12, top: 34, width: popup === "account" ? 300 : 260 }}>
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-orange-500/10 px-3 py-2">
              <span className="text-base">🦊</span>
              <span className="text-xs font-semibold text-orange-200">Wallet extension</span>
              <span className="ml-auto font-mono text-[10px] text-zinc-500">{short(me.address, 3)}</span>
              <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={() => setPopup("closed")}>✕</button>
            </div>
            {(popup === "confirm-token" || popup === "confirm-deploy") && (
              <div className="p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">request from</div>
                <div className="font-mono text-[11px] text-zinc-300">{brand.site}</div>
                <div className="mt-2 text-sm font-semibold text-zinc-100">{popup === "confirm-deploy" ? "Deploy contract" : "Contract interaction"}</div>
                <dl className="mt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between"><dt className="text-zinc-500">from</dt><dd className="font-mono text-zinc-300">{label(me.address)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">to</dt><dd className="font-mono text-zinc-300">{popup === "confirm-deploy" ? <span className="text-zinc-500">(none: creates a new contract)</span> : <>SHOP contract · {short(tokenAddr ?? "", 3)}</>}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">value</dt><dd className="font-mono text-zinc-300">0 ETH</dd></div>
                  <div className="flex justify-between gap-2"><dt className="shrink-0 text-zinc-500">data</dt><dd className="truncate font-mono text-violet-300">{popup === "confirm-deploy" ? `deploy token("Shop Token", "SHOP", 1000)` : `transfer(${label(sim.accounts[to].address)}, ${tokenAmount})`}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">nonce</dt><dd className="font-mono text-zinc-300">{nonce}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">gas fee</dt><dd className="font-mono text-zinc-300">{(popup === "confirm-deploy" ? GAS_DEPLOY : GAS_CALL).toLocaleString()} gas × {fmtGwei(GAS_PRICE)} = {fmtEth((popup === "confirm-deploy" ? GAS_DEPLOY : GAS_CALL) * GAS_PRICE)}</dd></div>
                </dl>
                <div className="mt-2 rounded bg-zinc-900 p-2 text-[10px] leading-snug text-zinc-500">{popup === "confirm-deploy" ? "This transaction carries a program instead of a payment. Every node will store it at a new address and run it whenever someone calls it." : "The ETH value is zero. The tokens move inside the contract’s storage when every node runs its transfer code. Running code costs more gas than a plain transfer."}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="rounded border border-zinc-700 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800" onClick={() => setPopup("closed")}>Reject</button>
                  <button className="rounded bg-orange-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-orange-400" onClick={confirm}>Confirm</button>
                </div>
              </div>
            )}
            {popup === "confirm" && (
              <div className="p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">request from</div>
                <div className="font-mono text-[11px] text-zinc-300">{brand.site}</div>
                <div className="mt-2 text-sm font-semibold text-zinc-100">Confirm transaction</div>
                <dl className="mt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between"><dt className="text-zinc-500">from</dt><dd className="font-mono text-zinc-300">{label(me.address)} · {short(me.address, 3)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">to</dt><dd className="font-mono text-zinc-300">{label(sim.accounts[to].address)} · {short(sim.accounts[to].address, 3)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">amount</dt><dd className="font-mono text-zinc-100">{fmtEth(value)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">nonce</dt><dd className="font-mono text-zinc-300">{nonce} <span className="text-zinc-600">(tx #{nonce + 1} from this account)</span></dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">gas fee</dt><dd className="font-mono text-zinc-300">{GAS_PER_TX.toLocaleString()} gas × {fmtGwei(GAS_PRICE)} = {fmtEth(fee)}</dd></div>
                  <div className="flex justify-between border-t border-zinc-800 pt-1"><dt className="text-zinc-400">total</dt><dd className="font-mono text-zinc-100">{fmtEth(value + fee)}</dd></div>
                </dl>
                <div className="mt-2 rounded bg-zinc-900 p-2 text-[10px] leading-snug text-zinc-500">The website built this transaction but cannot sign it. Only this extension holds the private key. The nonce is a counter: it keeps transactions in order and stops anyone replaying this one.</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="rounded border border-zinc-700 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800" onClick={() => setPopup("closed")}>Reject</button>
                  <button className="rounded bg-orange-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-orange-400" onClick={confirm}>Confirm</button>
                </div>
              </div>
            )}
            {popup === "signing" && (
              <div className="flex flex-col items-center gap-2 p-5 text-xs text-zinc-300">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="h-5 w-5 rounded-full border-2 border-orange-400 border-t-transparent" />
                Signing with the private key…
              </div>
            )}
            {popup === "account" && <AccountView priv={me.priv} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Private key → public key → keccak → address, with real numbers. */
function AccountView({ priv }: { priv: string }) {
  const [reveal, setReveal] = useState(false);
  const [demoPriv, setDemoPriv] = useState<string | null>(null);
  const kp = useMemo(() => keypairFromPriv(fromHex(demoPriv ?? priv)), [demoPriv, priv]);
  const pubHash = keccak(fromHex(kp.pub).slice(1));
  const mask = (h: string) => (reveal ? h : h.slice(0, 6) + "•".repeat(20) + h.slice(-4));
  return (
    <div className="p-3 text-xs">
      <div className="text-sm font-semibold text-zinc-100">{demoPriv ? "A throwaway account" : "My account"}</div>
      <div className="mt-0.5 text-[10px] text-zinc-500">Where an address comes from. Every arrow is a one-way function.</div>
      <div className="mt-3 space-y-2">
        <Row n={1} title="Private key · 32 random bytes" value={mask(kp.priv)} hint="Generated on this device. Never shared. This is what a seed phrase encodes." cls="text-rose-300" />
        <div className="pl-6 text-[10px] text-orange-400">↓ elliptic-curve multiply (secp256k1)</div>
        <Row n={2} title="Public key · 64 bytes" value={short(kp.pub, 14)} hint="Anyone may see it. It can verify signatures, never make them." />
        <div className="pl-6 text-[10px] text-orange-400">↓ keccak256</div>
        <Row n={3} title="Hash of the public key" value={pubHash.slice(0, 26) + " " + pubHash.slice(26)} hint="32 bytes. Only the last 20 are kept." cls="text-zinc-500" />
        <div className="pl-6 text-[10px] text-orange-400">↓ keep the last 20 bytes</div>
        <Row n={4} title="Address" value={kp.address} hint="What you give to people. It cannot be traced back to the key." cls="text-emerald-300" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800" onClick={() => setReveal(!reveal)}>{reveal ? "hide key" : "reveal key"}</button>
        <button className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800" onClick={() => { const b = new Uint8Array(32); crypto.getRandomValues(b); setDemoPriv("0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")); }}>new random key →</button>
        {demoPriv && <button className="text-[11px] text-zinc-500 hover:text-zinc-300" onClick={() => setDemoPriv(null)}>back to mine</button>}
      </div>
    </div>
  );
}

function Row({ n, title, value, hint, cls = "text-zinc-300" }: { n: number; title: string; value: string; hint: string; cls?: string }) {
  return (
    <div className="relative pl-6">
      <span className="absolute left-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500/20 text-[9px] font-semibold text-orange-300">{n}</span>
      <div className="text-[11px] font-semibold text-zinc-200">{title}</div>
      <div className={`break-all font-mono text-[10px] ${cls}`}>{value}</div>
      <div className="text-[10px] text-zinc-500">{hint}</div>
    </div>
  );
}
