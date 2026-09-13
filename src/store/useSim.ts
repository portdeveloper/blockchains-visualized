"use client";
import { create } from "zustand";
import { Simulation } from "@/sim/sim";
import { Hex } from "@/sim/crypto";
import { ETH } from "@/lib/eth";

export interface RpcHistoryItem {
  id: number;
  nodeId: number;
  method: string;
  params: unknown[];
  response: unknown;
  at: number;
}

interface SimStore {
  sim: Simulation;
  version: number;
  running: boolean;
  speed: number;
  selectedNode: number;
  selectedBlock: Hex | null;
  selectedTx: Hex | null;
  rpcHistory: RpcHistoryItem[];
  tick: (dtMs: number) => void;
  bump: () => void;
  setRunning: (r: boolean) => void;
  setSpeed: (s: number) => void;
  selectNode: (id: number) => void;
  selectBlock: (h: Hex | null) => void;
  selectTx: (h: Hex | null) => void;
  reset: (seed?: number) => void;
  rpc: (nodeId: number, method: string, params: unknown[]) => unknown;
  toggleNode: (id: number) => void;
  setBlockTime: (ms: number) => void;
}

let rpcId = 1;

export const useSim = create<SimStore>((set, get) => ({
  sim: new Simulation({ seed: 42, nodeCount: 6, blockTimeMs: 5000, initialBalance: 10 * ETH }),
  version: 0,
  running: true,
  speed: 1,
  selectedNode: 0,
  selectedBlock: null,
  selectedTx: null,
  rpcHistory: [],
  tick: (dt) => {
    get().sim.step(dt);
    set((s) => ({ version: s.version + 1 }));
  },
  bump: () => set((s) => ({ version: s.version + 1 })),
  setRunning: (running) => set({ running }),
  setSpeed: (speed) => set({ speed }),
  selectNode: (selectedNode) => set({ selectedNode }),
  selectBlock: (selectedBlock) => set({ selectedBlock, selectedTx: null }),
  selectTx: (selectedTx) => set({ selectedTx }),
  reset: (seed = 42) => set({ sim: new Simulation({ seed, nodeCount: 6, blockTimeMs: 5000, initialBalance: 10 * ETH }), version: 0, selectedBlock: null, selectedTx: null, rpcHistory: [] }),
  toggleNode: (id) => {
    const n = get().sim.nodes[id];
    n.online = !n.online;
    set((s) => ({ version: s.version + 1 }));
  },
  setBlockTime: (ms) => {
    const { sim } = get();
    sim.nextProposalAt = sim.now + ms;
    sim.blockTimeMs = ms;
    set((s) => ({ version: s.version + 1 }));
  },
  rpc: (nodeId, method, params) => {
    const { sim } = get();
    const response = sim.rpc(nodeId, { method, params });
    set((s) => ({
      rpcHistory: [{ id: rpcId++, nodeId, method, params, response, at: sim.now }, ...s.rpcHistory].slice(0, 30),
      version: s.version + 1,
    }));
    return response;
  },
}));
