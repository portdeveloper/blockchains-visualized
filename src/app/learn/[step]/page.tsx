import Link from "next/link";
import { notFound } from "next/navigation";
import { STEPS } from "@/components/learn/steps";

export function generateStaticParams() {
  return STEPS.map((s) => ({ step: s.slug }));
}

export default async function StepPage({ params }: PageProps<"/learn/[step]">) {
  const { step } = await params;
  const idx = STEPS.findIndex((s) => s.slug === step);
  if (idx < 0) notFound();
  const s = STEPS[idx];
  const prev = STEPS[idx - 1];
  const next = STEPS[idx + 1];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <nav className="flex flex-wrap items-center gap-1 text-xs">
        <Link href="/course" className="mr-2 text-zinc-500 hover:text-zinc-300">Build a blockchain</Link>
        {STEPS.map((st, i) => (
          <Link key={st.slug} href={`/learn/${st.slug}`} className={`rounded px-2 py-1 ${i === idx ? "bg-amber-500/15 text-amber-300" : i < idx ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-600 hover:bg-zinc-800"}`}>
            {i + 1}. {st.adds}
          </Link>
        ))}
        <Link href="/playground" className="ml-auto text-zinc-600 hover:text-zinc-300">skip to the full network →</Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <div className="text-xs uppercase tracking-wider text-amber-400">Step {idx + 1} of {STEPS.length} · adds: {s.adds}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">{s.title}</h1>
          <div className="prose-sm mt-4 space-y-3 text-sm leading-relaxed text-zinc-300 [&_b]:text-zinc-100 [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:font-mono [&_code]:text-amber-300">{s.body}</div>
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">Try this</div>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-zinc-300">{s.tryThis.map((t) => <li key={t}>{t}</li>)}</ol>
          </div>
          <div className="mt-6 flex items-center justify-between text-sm">
            {prev ? <Link href={`/learn/${prev.slug}`} className="text-zinc-400 hover:text-zinc-200">← {prev.adds}</Link> : <span />}
            {next
              ? <Link href={`/learn/${next.slug}`} className="rounded bg-amber-500 px-3 py-1.5 font-medium text-zinc-950 hover:bg-amber-400">Next: add {next.adds} →</Link>
              : <Link href="/playground" className="rounded bg-amber-500 px-3 py-1.5 font-medium text-zinc-950 hover:bg-amber-400">See the full network →</Link>}
          </div>
        </div>
        <div className="min-w-0">{s.widget}</div>
      </div>
    </div>
  );
}
