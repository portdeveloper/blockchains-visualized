"use client";
import { SimpleBlock, blockHash, isMined, mine } from "@/lib/blockhash";
import { short } from "@/sim/crypto";
import { useState } from "react";
import { Box, Field, inp, btn, HashOut } from "./Box";

export function BlockBox({ block, onChange, showPrev = true, compact = false, ports }: {
  block: SimpleBlock; onChange: (b: SimpleBlock) => void; showPrev?: boolean; compact?: boolean; ports?: { in?: boolean; out?: boolean };
}) {
  const hash = blockHash(block);
  const ok = isMined(hash);
  const [mining, setMining] = useState(false);
  const [attempts, setAttempts] = useState<number | null>(null);
  const doMine = () => {
    setMining(true);
    setTimeout(() => {
      const r = mine(block);
      onChange({ ...block, nonce: r.nonce });
      setAttempts(r.attempts);
      setMining(false);
    }, 10);
  };
  return (
    <Box title={`Block #${block.number}`} status={ok ? "ok" : "bad"} ports={ports} className={compact ? "w-56" : "w-72"}>
      <div className="grid gap-2">
        <Field label="nonce">
          <div className="flex gap-1">
            <input className={inp} value={block.nonce} onChange={(e) => onChange({ ...block, nonce: parseInt(e.target.value) || 0 })} />
            <button className={btn} onClick={() => onChange({ ...block, nonce: block.nonce + 1 })}>+1</button>
          </div>
        </Field>
        <Field label="data">
          <textarea className={`${inp} resize-none ${compact ? "h-10" : "h-16"}`} value={block.data} onChange={(e) => onChange({ ...block, data: e.target.value })} />
        </Field>
        {showPrev && (
          <Field label="prev (hash of previous block)">
            <div className="truncate rounded bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-400" title={block.prev}>{compact ? short(block.prev, 8) : block.prev}</div>
          </Field>
        )}
        <Field label="hash">
          <HashOut hash={compact ? short(hash, 10) : hash} good={ok} />
        </Field>
        <div className="flex items-center gap-2">
          <button className={`${btn} ${ok ? "" : "border-amber-500 text-amber-300"}`} onClick={doMine} disabled={mining || ok}>{mining ? "mining…" : ok ? "✓ mined" : "⛏ mine"}</button>
          <span className="text-[10px] text-zinc-500">{ok ? "starts with 0000" : "must start with 0000"}{attempts && ok ? ` · ${attempts.toLocaleString()} tries` : ""}</span>
        </div>
      </div>
    </Box>
  );
}
