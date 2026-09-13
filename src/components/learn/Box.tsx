import { ReactNode } from "react";

/** A node in the machine we're building. eth.build-style: dark box with colored ports. */
export function Box({ title, children, status, className = "", ports }: {
  title: string; children: ReactNode; status?: "ok" | "bad" | "none"; className?: string;
  ports?: { in?: boolean; out?: boolean };
}) {
  const border = status === "ok" ? "border-emerald-500/70" : status === "bad" ? "border-rose-500/70" : "border-zinc-700";
  const bg = status === "ok" ? "bg-emerald-950/30" : status === "bad" ? "bg-rose-950/30" : "bg-zinc-900";
  return (
    <div className={`relative rounded-lg border ${border} ${bg} shadow-lg ${className}`}>
      {ports?.in && <span className="absolute -left-1.5 top-4 h-3 w-3 rounded-full border-2 border-zinc-900 bg-amber-400" />}
      {ports?.out && <span className="absolute -right-1.5 top-4 h-3 w-3 rounded-full border-2 border-zinc-900 bg-amber-400" />}
      <div className="rounded-t-lg border-b border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function Wire({ vertical = false }: { vertical?: boolean }) {
  return vertical
    ? <div className="mx-auto flex h-6 w-px flex-col items-center bg-amber-400/60"><span className="mt-auto text-[10px] leading-none text-amber-400">▼</span></div>
    : <div className="flex w-8 shrink-0 items-center"><div className="h-px flex-1 bg-amber-400/60" /><span className="text-[10px] leading-none text-amber-400">▶</span></div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[11px] text-zinc-500">
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

export const inp = "w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-100 outline-none focus:border-amber-400";
export const btn = "rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-40";

export function HashOut({ hash, good }: { hash: string; good?: boolean }) {
  const cls = good === undefined ? "text-amber-300" : good ? "text-emerald-300" : "text-rose-300";
  return <div className={`break-all rounded bg-zinc-950 px-2 py-1 font-mono text-[11px] ${cls}`}>{hash}</div>;
}
