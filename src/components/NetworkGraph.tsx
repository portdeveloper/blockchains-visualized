"use client";
import { useSim } from "@/store/useSim";
import { short } from "@/sim/crypto";
import { Panel, Tag } from "./ui";

const W = 520, H = 340, R = 125;

export function NetworkGraph() {
  useSim((s) => s.version);
  const sim = useSim((s) => s.sim);
  const selected = useSim((s) => s.selectedNode);
  const selectNode = useSim((s) => s.selectNode);
  const toggleNode = useSim((s) => s.toggleNode);

  const n = sim.nodes.length;
  const pos = sim.nodes.map((_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: W / 2 + R * Math.cos(a), y: H / 2 + R * Math.sin(a) };
  });
  const links: [number, number][] = [];
  sim.nodes.forEach((node) => node.peers.forEach((p) => { if (node.id < p) links.push([node.id, p]); }));
  const proposer = sim.currentProposer();
  const untilNext = Math.max(0, sim.nextProposalAt - sim.now);

  return (
    <Panel
      title="P2P network"
      right={<span className="text-[11px] text-zinc-500">next block in <span className="font-mono text-zinc-300">{(untilNext / 1000).toFixed(1)}s</span> · proposer <span className="text-amber-300">{proposer?.name}</span></span>}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {links.map(([a, b]) => {
          const blocked = sim.net.isBlocked(a, b);
          return (
            <g key={`${a}-${b}`}>
              <line x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} stroke={blocked ? "#f43f5e" : "#3f3f46"} strokeWidth={blocked ? 1.5 : 1} strokeDasharray={blocked ? "4 4" : undefined} />
              <text x={(pos[a].x + pos[b].x) / 2} y={(pos[a].y + pos[b].y) / 2 - 4} fill="#52525b" fontSize={9} textAnchor="middle" className="font-mono">{sim.net.getLatency(a, b)}ms</text>
            </g>
          );
        })}
        {sim.inflight().map((m) => {
          const p = Math.min(1, Math.max(0, (sim.now - m.sentAt) / (m.deliverAt - m.sentAt)));
          const x = pos[m.from].x + (pos[m.to].x - pos[m.from].x) * p;
          const y = pos[m.from].y + (pos[m.to].y - pos[m.from].y) * p;
          const isBlock = m.kind === "block";
          return isBlock
            ? <rect key={m.id} x={x - 5} y={y - 5} width={10} height={10} rx={2} fill="#f59e0b" />
            : <circle key={m.id} cx={x} cy={y} r={3.5} fill="#38bdf8" />;
        })}
        {sim.nodes.map((node, i) => {
          const isSel = i === selected;
          const isProp = proposer?.id === i;
          return (
            <g key={i} className="cursor-pointer" onClick={() => selectNode(i)}>
              <circle cx={pos[i].x} cy={pos[i].y} r={22} fill={node.online ? "#18181b" : "#27272a"} stroke={isSel ? "#38bdf8" : isProp ? "#f59e0b" : node.online ? "#10b981" : "#52525b"} strokeWidth={isSel ? 3 : 2} />
              <text x={pos[i].x} y={pos[i].y - 2} fill="#e4e4e7" fontSize={11} textAnchor="middle" fontWeight={600}>#{node.head().header.number}</text>
              <text x={pos[i].x} y={pos[i].y + 10} fill="#a1a1aa" fontSize={9} textAnchor="middle" className="font-mono">{node.mempool.size} tx</text>
              <text x={pos[i].x} y={pos[i].y + 36} fill={node.online ? "#d4d4d8" : "#71717a"} fontSize={10} textAnchor="middle">{node.name}{node.online ? "" : " (offline)"}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" /> transaction</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> block</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-emerald-500" /> node (head #, mempool size)</span>
        <span className="ml-auto flex items-center gap-2">
          <Tag color="sky">{sim.nodes[selected].name}</Tag>
          <span className="font-mono text-zinc-500">{short(sim.nodes[selected].address, 5)}</span>
          <button className="rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800" onClick={() => toggleNode(selected)}>
            {sim.nodes[selected].online ? "take offline" : "bring online"}
          </button>
        </span>
      </div>
    </Panel>
  );
}
