import Link from "next/link";
import { STEPS } from "@/components/learn/steps";

export default function Course() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold text-zinc-100">Build a blockchain from scratch</h1>
      <ol className="grid gap-2">
        {STEPS.map((s, i) => (
          <li key={s.slug}><Link href={`/learn/${s.slug}`} className="flex items-center gap-4 rounded-lg border border-zinc-800 px-4 py-3 hover:border-amber-500/50"><span className="font-mono text-2xl text-amber-400">{i + 1}</span><span className="text-zinc-100">{s.title}</span></Link></li>
        ))}
      </ol>
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">← back to the live view</Link>
    </div>
  );
}
