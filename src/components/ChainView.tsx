"use client";
import { useSim } from "@/store/useSim";
import { short } from "@/sim/crypto";
import { Panel } from "./ui";

export function ChainView() {
  useSim((s) => s.version);
  const sim = useSim((s) => s.sim);
  const nodeId = useSim((s) => s.selectedNode);
  const selectedBlock = useSim((s) => s.selectedBlock);
  const selectBlock = useSim((s) => s.selectBlock);
  const node = sim.nodes[nodeId];
  const blocks = node.chain.slice(-12);

  return (
    <Panel title={`Chain as seen by ${node.name}`} right={<span className="text-[11px] text-zinc-500">{node.chain.length} blocks · click a block to inspect</span>}>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {blocks.map((b, i) => {
          const sel = b.hash === selectedBlock;
          const proposerNode = sim.nodes.find((n) => n.address === b.header.proposer);
          return (
            <div key={b.hash} className="flex items-center">
              {i > 0 && <div className="flex flex-col items-center px-1 text-zinc-600"><span className="text-xs">←</span></div>}
              <button
                onClick={() => selectBlock(sel ? null : b.hash)}
                className={`w-[118px] shrink-0 rounded-md border p-2 text-left transition ${sel ? "border-amber-400 bg-amber-500/10" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-zinc-100">#{b.header.number}</span>
                  <span className="text-[10px] text-zinc-500">{b.txs.length} tx</span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-amber-300/90">{short(b.hash, 5)}</div>
                <div className="font-mono text-[10px] text-zinc-500">↑ {short(b.header.parentHash, 4)}</div>
                <div className="mt-1 truncate text-[10px] text-zinc-400">{b.header.number === 0 ? "genesis" : proposerNode?.name ?? short(b.header.proposer)}</div>
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
