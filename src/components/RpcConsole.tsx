"use client";
import { useState } from "react";
import { useSim } from "@/store/useSim";
import { RPC_METHODS } from "@/sim/rpc";
import { Panel, Mono, btn, input } from "./ui";

const EXAMPLES: Record<string, (a: { addr: string; txHash: string | null }) => unknown[]> = {
  eth_blockNumber: () => [],
  net_peerCount: () => [],
  eth_getBalance: ({ addr }) => [addr, "latest"],
  eth_getTransactionCount: ({ addr }) => [addr, "pending"],
  eth_getBlockByNumber: () => ["latest", false],
  eth_getTransactionByHash: ({ txHash }) => [txHash ?? "0x…"],
  eth_getTransactionReceipt: ({ txHash }) => [txHash ?? "0x…"],
  txpool_content: () => [],
  eth_sendRawTransaction: () => ["0x… (use the wallet panel; it calls this for you)"],
};

export function RpcConsole() {
  useSim((s) => s.version);
  const sim = useSim((s) => s.sim);
  const nodeId = useSim((s) => s.selectedNode);
  const rpc = useSim((s) => s.rpc);
  const history = useSim((s) => s.rpcHistory);
  const selectedTx = useSim((s) => s.selectedTx);
  const [method, setMethod] = useState<string>("eth_getBalance");
  const [params, setParams] = useState(JSON.stringify(EXAMPLES.eth_getBalance({ addr: sim.accounts[0].address, txHash: null })));
  const [err, setErr] = useState<string | null>(null);

  const lastTx = selectedTx ?? history.find((h) => h.method === "eth_sendRawTransaction" && (h.response as { result?: string }).result)?.response as { result?: string } | undefined;
  const txHash = typeof lastTx === "string" ? lastTx : lastTx?.result ?? null;

  const pick = (m: string) => {
    setMethod(m);
    setParams(JSON.stringify(EXAMPLES[m]({ addr: sim.accounts[0].address, txHash })));
  };
  const run = () => {
    try {
      const p = JSON.parse(params);
      setErr(null);
      rpc(nodeId, method, p);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <Panel title="JSON-RPC console" right={<span className="text-[11px] text-zinc-500">→ <span className="text-sky-300">{sim.nodes[nodeId].name}</span> (change by clicking a node)</span>}>
      <div className="flex flex-wrap gap-1">
        {RPC_METHODS.map((m) => (
          <button key={m} onClick={() => pick(m)} className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${m === method ? "bg-sky-500/20 text-sky-200" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>{m}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className={input} value={params} onChange={(e) => setParams(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
        <button className={`${btn} shrink-0`} onClick={run}>send</button>
      </div>
      {err && <div className="mt-1 text-[11px] text-rose-300">params must be a JSON array: {err}</div>}
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {history.map((h) => (
          <div key={h.id} className="rounded bg-zinc-950 p-2 text-[11px]">
            <div className="flex items-center gap-2 text-zinc-500">
              <span className="text-zinc-600">t={(h.at / 1000).toFixed(1)}s</span>
              <span className="text-sky-300">{sim.nodes[h.nodeId].name}</span>
              <Mono className="text-zinc-300">{h.method}</Mono>
              <Mono className="truncate text-zinc-500">{JSON.stringify(h.params)}</Mono>
            </div>
            <pre className={`mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] ${(h.response as { error?: unknown }).error ? "text-rose-300" : "text-emerald-200/90"}`}>{JSON.stringify(h.response, null, 1)}</pre>
          </div>
        ))}
      </div>
    </Panel>
  );
}
