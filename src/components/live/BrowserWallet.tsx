"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLive, Owner } from "@/store/useLive";
import { short, keypairFromPriv, keccak, fromHex } from "@/sim/crypto";
import { GAS_PER_TX } from "@/sim/tx";
import { fmtEth, fmtGwei, parseEth } from "@/lib/eth";

const GAS_PRICE = 2;

export function accountName(sim: { accounts: { address: string }[] }, a: string, style: "short" | "long" = "short") {
  const i = sim.accounts.findIndex((k) => k.address === a);
  if (i === 0) return "you";
  if (i === 1) return "Bob";
  if (i > 1) return style === "short" ? `w${i}` : `wallet ${i}`;
  return null;
}

/** A browser window with a website (dapp) inside and a wallet extension popup. Used for you (left) and Bob (right). */
export function BrowserWallet({ x, y, w, h, owner, compact = false }: { x: number; y: number; w: number; h: number; owner: Owner; compact?: boolean }) {
  useLive((s) => s.version);
  const st = useLive();
  const { sim, tracked, setTracked, send, speed, tokenAddr, tokenBalances, deployToken, sendToken } = st;
  const tokenBal = tokenBalances[owner];
  const [tokenAmount, setTokenAmount] = useState(owner === "you" ? "10" : "50");
  const [tokenTo, setTokenTo] = useState(owner === "you" ? 1 : 0);
  const pendingDeploy = st.appTxs.some((t) => t.label?.startsWith("deploy") && (t.status === "pending" || t.status === "sent" || t.status === "signing"));
  const acctIdx = owner === "you" ? 0 : st.bobAccount;
  const nodeId = owner === "you" ? st.rpcNode : st.bobNode;
  const balance = owner === "you" ? st.balance : st.bobBalance;
  const blockNumber = owner === "you" ? st.blockNumber : st.bobBlockNumber;
  const appTxs = st.appTxs.filter((t) => t.owner === owner);
  const toasts = st.incoming.filter((t) => t.owner === owner);
  const [to, setTo] = useState(owner === "you" ? 1 : 0);
  const [amount, setAmount] = useState(owner === "you" ? "0.1" : "0.05");
  const [popup, setPopup] = useState<"closed" | "confirm" | "confirm-token" | "confirm-deploy" | "signing" | "account">("closed");
  const me = sim.accounts[acctIdx];
  const value = parseEth(amount);
  const fee = GAS_PER_TX * GAS_PRICE;
  const nonceRes = sim.rpc(nodeId, { method: "eth_getTransactionCount", params: [me.address, "pending"] });
  const nonce = nonceRes.result ? parseInt(nonceRes.result as string, 16) : 0;
  const site = owner === "you" ? "pay.example.app" : "bobs-shop.example";
  const label = (a: string) => accountName(sim, a, "long") ?? short(a, 3);

  const confirm = async () => {
    const mode = popup;
    setPopup("signing");
    setTimeout(() => setPopup("closed"), 900 / speed);
    if (mode === "confirm-deploy") await deployToken();
    else if (mode === "confirm-token") await sendToken(tokenTo, parseInt(tokenAmount) || 0, owner);
    else await send(to, value, owner);
  };
  const GAS_CALL = 50_000, GAS_DEPLOY = 100_000;

  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: h }}>
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-800/80 px-3 py-1.5">
          <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" /><i className="h-2.5 w-2.5 rounded-full bg-amber-400" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          <div className="flex flex-1 items-center gap-1.5 truncate rounded bg-zinc-950 px-2 py-0.5 font-mono text-[10px] text-zinc-400"><span className="text-emerald-400">🔒</span> {site}</div>
          <button title="Wallet extension: my account" onClick={() => setPopup(popup === "closed" ? "account" : "closed")} className="rounded px-1 text-sm hover:bg-zinc-700">🦊</button>
        </div>
        <div className={`grid min-h-0 flex-1 grid-cols-[minmax(0,11fr)_minmax(0,9fr)] gap-3 ${compact ? "p-2.5" : "p-3"}`}>
         <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between">
            <span className={`font-semibold text-zinc-100 ${compact ? "text-xs" : "text-sm"}`}>{owner === "you" ? "Send tokens" : "Bob's shop"}</span>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-px font-mono text-[10px] text-emerald-300">● {owner === "bob" ? "Bob · " : ""}{short(me.address, 3)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[11px] text-zinc-500">balance <span className="text-zinc-600">· block #{blockNumber}</span></span>
            <motion.span key={balance} initial={{ scale: 1.15, color: "#7dd3fc" }} animate={{ scale: 1, color: "#f4f4f5" }} className="whitespace-nowrap font-mono text-lg font-semibold">{fmtEth(balance)}</motion.span>
          </div>
          <div className={`mt-2 grid gap-2 text-xs ${compact ? "grid-cols-[minmax(0,1fr)_64px]" : "grid-cols-[minmax(0,1fr)_84px]"}`}>
            <select className="min-w-0 truncate rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[11px]" value={to} onChange={(e) => setTo(+e.target.value)}>
              {sim.accounts.map((k, i) => i !== acctIdx && <option key={k.address} value={i}>to {label(k.address)} ({short(k.address, 3)})</option>)}
            </select>
            <div className="relative min-w-0"><input className={`w-full min-w-0 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs ${compact ? "" : "pr-8"}`} value={amount} onChange={(e) => setAmount(e.target.value)} title="amount in ETH" />{!compact && <span className="pointer-events-none absolute right-2 top-1.5 text-[9px] text-zinc-500">ETH</span>}</div>
          </div>
          <button className="mt-2 w-full rounded bg-sky-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-sky-400 disabled:opacity-50" disabled={popup !== "closed"} onClick={() => setPopup("confirm")}>{owner === "you" ? "Send" : "Pay"}</button>
          {/* SHOP token: a smart contract. Balance comes from a free eth_call; transfers are txs to the contract. */}
          {tokenAddr ? (
            <div className="mt-2 rounded border border-violet-500/40 bg-violet-500/10 p-2 text-[11px]">
              <div className="text-[10px] text-violet-400/80">SHOP token · contract {short(tokenAddr, 3)} · read via free eth_call</div>
              <div className="flex items-baseline justify-between">
                <span className="text-violet-200">your tokens</span>
                <span className="whitespace-nowrap font-mono text-sm font-semibold text-violet-100">{tokenBal ?? "…"} <span className="text-[10px] font-normal text-violet-300">SHOP</span></span>
              </div>
              <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_48px_auto] gap-1.5">
                <select className="min-w-0 truncate rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px]" value={tokenTo} onChange={(e) => setTokenTo(+e.target.value)}>
                  {sim.accounts.map((k, i) => i !== acctIdx && <option key={k.address} value={i}>to {label(k.address)}</option>)}
                </select>
                <input className="min-w-0 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px]" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} />
                <button className="rounded bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-zinc-950 hover:bg-violet-400 disabled:opacity-50" disabled={popup !== "closed"} onClick={() => setPopup("confirm-token")}>Send SHOP</button>
              </div>
            </div>
          ) : owner === "bob" ? (
            <button className="mt-2 w-full rounded border border-violet-500/50 bg-violet-500/10 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50" disabled={popup !== "closed" || pendingDeploy} onClick={() => setPopup("confirm-deploy")}>
              {pendingDeploy ? "deploying SHOP token…" : "Deploy a SHOP token (smart contract)"}
            </button>
          ) : null}
         </div>
         <div className="flex min-h-0 flex-col">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">activity</div>
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                +{fmtEth(t.value)} received from {label(t.from)} in block #{t.block}.{!compact && " You did nothing; the chain simply updated."}
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="mt-1 min-h-0 flex-1 space-y-1 overflow-hidden text-[11px]">
            {appTxs.length === 0 && <div className="text-zinc-600">{owner === "you" ? "No activity yet. Press Send: the site builds a transaction and asks your wallet to sign it." : "Bob is connected to a different node through a different RPC. Pay someone as Bob."}</div>}
            {appTxs.map((t) => (
              <div key={t.hash} onClick={() => setTracked(t.hash)} title={t.error} className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded bg-zinc-950 px-2 py-1 ${tracked === t.hash ? "tx-glow" : ""}`}>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-zinc-300">{t.label ?? `${fmtEth(t.value)} → ${label(sim.accounts[t.to].address)}`}</span> <span className="text-zinc-600">nonce {t.tx.nonce}</span>{t.fee && <span className="text-zinc-600"> · fee {fmtEth(t.fee)}</span>}
                </span>
                <span className={`shrink-0 rounded px-1.5 py-px text-[10px] ${t.status === "mined" ? "bg-emerald-500/20 text-emerald-300" : t.status === "rejected" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {t.status === "mined" ? `✓ block #${t.block}` : t.status === "rejected" ? (t.error?.startsWith("dropped") ? "dropped" : "rejected") : t.status}
                </span>
              </div>
            ))}
          </div>
         </div>
        </div>
      </div>

      <AnimatePresence>
        {popup !== "closed" && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.18 }}
            className="absolute z-50 overflow-hidden rounded-xl border border-orange-500/50 bg-zinc-950 shadow-2xl" style={{ right: 12, top: 34, width: popup === "account" ? 300 : 260 }}>
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-orange-500/10 px-3 py-2">
              <span className="text-base">🦊</span>
              <span className="text-xs font-semibold text-orange-200">Wallet extension</span>
              <span className="ml-auto font-mono text-[10px] text-zinc-500">{short(me.address, 3)}</span>
              <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={() => setPopup("closed")}>✕</button>
            </div>
            {(popup === "confirm-token" || popup === "confirm-deploy") && (
              <div className="p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">request from</div>
                <div className="font-mono text-[11px] text-zinc-300">{site}</div>
                <div className="mt-2 text-sm font-semibold text-zinc-100">{popup === "confirm-deploy" ? "Deploy contract" : "Contract interaction"}</div>
                <dl className="mt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between"><dt className="text-zinc-500">from</dt><dd className="font-mono text-zinc-300">{label(me.address)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">to</dt><dd className="font-mono text-zinc-300">{popup === "confirm-deploy" ? <span className="text-zinc-500">(none: creates a new contract)</span> : <>SHOP contract · {short(tokenAddr ?? "", 3)}</>}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">value</dt><dd className="font-mono text-zinc-300">0 ETH</dd></div>
                  <div className="flex justify-between gap-2"><dt className="shrink-0 text-zinc-500">data</dt><dd className="truncate font-mono text-violet-300">{popup === "confirm-deploy" ? `deploy token("Shop Token", "SHOP", 1000)` : `transfer(${label(sim.accounts[tokenTo].address)}, ${parseInt(tokenAmount) || 0})`}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">gas fee</dt><dd className="font-mono text-zinc-300">{(popup === "confirm-deploy" ? GAS_DEPLOY : GAS_CALL).toLocaleString()} gas × {fmtGwei(GAS_PRICE)} = {fmtEth((popup === "confirm-deploy" ? GAS_DEPLOY : GAS_CALL) * GAS_PRICE)}</dd></div>
                </dl>
                <div className="mt-2 rounded bg-zinc-900 p-2 text-[10px] leading-snug text-zinc-500">{popup === "confirm-deploy" ? "This transaction carries a program instead of a payment. Every node will store it at a new address and run it whenever someone calls it." : "The ETH value is zero. The tokens move inside the contract\u2019s storage when every node runs its transfer code. Running code costs more gas than a plain transfer."}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="rounded border border-zinc-700 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800" onClick={() => setPopup("closed")}>Reject</button>
                  <button className="rounded bg-orange-500 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-orange-400" onClick={confirm}>Confirm</button>
                </div>
              </div>
            )}
            {popup === "confirm" && (
              <div className="p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">request from</div>
                <div className="font-mono text-[11px] text-zinc-300">{site}</div>
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
