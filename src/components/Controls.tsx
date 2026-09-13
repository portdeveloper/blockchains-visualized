"use client";
import { useSim } from "@/store/useSim";
import { btn } from "./ui";

export function Controls() {
  useSim((s) => s.version);
  const { sim, running, speed, setRunning, setSpeed, reset, setBlockTime } = useSim();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button className={btn} onClick={() => setRunning(!running)}>{running ? "⏸ pause" : "▶ play"}</button>
      <span className="text-zinc-500">speed</span>
      {[0.25, 1, 3].map((s) => (
        <button key={s} className={`${btn} ${speed === s ? "border-sky-500 text-sky-300" : ""}`} onClick={() => setSpeed(s)}>{s}×</button>
      ))}
      <span className="ml-2 text-zinc-500">block time</span>
      {[2000, 5000, 10000].map((b) => (
        <button key={b} className={`${btn} ${sim.blockTimeMs === b ? "border-amber-500 text-amber-300" : ""}`} onClick={() => setBlockTime(b)}>{b / 1000}s</button>
      ))}
      <span className="ml-2 font-mono text-zinc-500">t = {(sim.now / 1000).toFixed(1)}s</span>
      <button className={`${btn} ml-auto`} onClick={() => reset(Math.floor(Math.random() * 1e6))}>↺ new network</button>
    </div>
  );
}
