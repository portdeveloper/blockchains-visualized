"use client";
import { SimpleBlock, blockHash, ZERO } from "@/lib/blockhash";
import { BlockBox } from "./BlockBox";
import { Wire } from "./Box";

export function makeChain(datas: string[]): SimpleBlock[] {
  const out: SimpleBlock[] = [];
  let prev = ZERO;
  datas.forEach((data, i) => {
    const b = { number: i + 1, nonce: 0, data, prev };
    out.push(b);
    prev = blockHash(b);
  });
  return out;
}

/** Re-link prev pointers so each block's prev is the current hash of the one before. */
export function relink(chain: SimpleBlock[]): SimpleBlock[] {
  let prev = ZERO;
  return chain.map((b) => {
    const nb = { ...b, prev };
    prev = blockHash(nb);
    return nb;
  });
}

export function Chain({ chain, onChange, compact = false }: { chain: SimpleBlock[]; onChange: (c: SimpleBlock[]) => void; compact?: boolean }) {
  const update = (i: number, b: SimpleBlock) => {
    const next = [...chain];
    next[i] = b;
    onChange(relink(next));
  };
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {chain.map((b, i) => (
        <div key={b.number} className="flex items-start">
          {i > 0 && <div className="pt-8"><Wire /></div>}
          <BlockBox block={b} onChange={(nb) => update(i, nb)} compact={compact} ports={{ in: i > 0, out: true }} />
        </div>
      ))}
    </div>
  );
}
