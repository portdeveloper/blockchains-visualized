"use client";
import { useState } from "react";
import { SimpleBlock, blockHash, mine } from "@/lib/blockhash";
import { Chain, makeChain, relink } from "./Chain";
import { short } from "@/sim/crypto";

function minedChain(datas: string[]): SimpleBlock[] {
  let chain = makeChain(datas);
  for (let i = 0; i < chain.length; i++) {
    chain[i] = { ...chain[i], nonce: mine(chain[i]).nonce };
    chain = relink(chain);
  }
  return chain;
}
const DATAS = ["Alice pays Bob 5", "Bob pays Carol 2", "Carol pays Dave 1"];

export function Step4Peers() {
  const [peers, setPeers] = useState<Record<string, SimpleBlock[]>>(() => {
    const c = minedChain(DATAS);
    return { Alice: c, Bob: c, Carol: c };
  });
  const heads = Object.fromEntries(Object.entries(peers).map(([k, c]) => [k, blockHash(c[c.length - 1])]));
  const counts = new Map<string, number>();
  Object.values(heads).forEach((h) => counts.set(h, (counts.get(h) ?? 0) + 1));
  const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(peers).map(([name, chain]) => {
        const agrees = heads[name] === majority[0];
        return (
          <div key={name} className={`rounded-lg border p-3 ${agrees ? "border-zinc-800" : "border-rose-500/50 bg-rose-950/20"}`}>
            <div className="mb-2 flex items-center gap-3 text-xs">
              <span className="font-semibold text-zinc-200">{name}&apos;s copy</span>
              <span className="font-mono text-zinc-500">head {short(heads[name], 8)}</span>
              <span className={`ml-auto rounded px-2 py-0.5 text-[11px] ${agrees ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                {agrees ? `agrees with ${majority[1]} of 3` : `disagrees with the other ${majority[1]}`}
              </span>
            </div>
            <Chain chain={chain} onChange={(c) => setPeers({ ...peers, [name]: c })} compact />
          </div>
        );
      })}
    </div>
  );
}
