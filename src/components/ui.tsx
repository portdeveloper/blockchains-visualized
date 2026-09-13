import { ReactNode } from "react";

export function Panel({ title, children, right, className = "" }: { title: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/60 ${className}`}>
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
        {right}
      </header>
      <div className="min-h-0 flex-1 p-3">{children}</div>
    </section>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] ${className}`}>{children}</span>;
}

export function Tag({ children, color = "zinc" }: { children: ReactNode; color?: "zinc" | "sky" | "amber" | "emerald" | "rose" }) {
  const c = {
    zinc: "bg-zinc-800 text-zinc-300",
    sky: "bg-sky-500/15 text-sky-300",
    amber: "bg-amber-500/15 text-amber-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    rose: "bg-rose-500/15 text-rose-300",
  }[color];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c}`}>{children}</span>;
}

export const btn = "rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-40";
export const input = "w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-100 outline-none focus:border-sky-500";
