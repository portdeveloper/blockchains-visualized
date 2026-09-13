"use client";
import { useState } from "react";
import { keccak } from "@/sim/crypto";
import { Box, Wire, Field, inp, HashOut } from "./Box";

export function Step1Hash() {
  const [text, setText] = useState("hello");
  const [prev, setPrev] = useState<string | null>(null);
  const hash = keccak(text);
  const changed = prev ? [...hash].filter((c, i) => c !== prev[i]).length - 0 : null;
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start">
      <Box title="Data" ports={{ out: true }} className="md:w-64">
        <Field label="type anything">
          <textarea className={`${inp} h-24 resize-none`} value={text} onChange={(e) => { setPrev(hash); setText(e.target.value); }} />
        </Field>
        <div className="mt-1 text-[10px] text-zinc-600">{text.length} characters</div>
      </Box>
      <div className="hidden md:block pt-8"><Wire /></div>
      <div className="md:hidden"><Wire vertical /></div>
      <Box title="Hash function (keccak256)" ports={{ in: true, out: true }} className="flex-1">
        <HashOut hash={hash} />
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
          <div><div className="text-zinc-200">64 hex chars</div>always, no matter the input size</div>
          <div><div className="text-zinc-200">{changed === null ? "—" : `${changed} / 64 changed`}</div>since your last keystroke</div>
          <div><div className="text-zinc-200">one-way</div>nobody can get the text back from this</div>
        </div>
      </Box>
    </div>
  );
}
