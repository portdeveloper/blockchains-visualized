"use client";
import { useEffect } from "react";
import { useSim } from "@/store/useSim";

/** Drives the simulation clock from requestAnimationFrame. */
export function SimRunner() {
  const tick = useSim((s) => s.tick);
  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const { running, speed } = useSim.getState();
      const dt = Math.min(100, t - last);
      last = t;
      if (running) tick(dt * speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tick]);
  return null;
}
