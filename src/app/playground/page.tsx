import { SimRunner } from "@/components/SimRunner";
import { NetworkGraph } from "@/components/NetworkGraph";
import { ChainView } from "@/components/ChainView";
import { BlockInspector } from "@/components/BlockInspector";
import { NodePanel } from "@/components/NodePanel";
import { Wallet } from "@/components/Wallet";
import { RpcConsole } from "@/components/RpcConsole";
import { EventLog } from "@/components/EventLog";
import { Controls } from "@/components/Controls";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-4">
      <SimRunner />
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Blockchains, visualized</h1>
          <p className="text-xs text-zinc-500">A live toy network in your browser. Real keccak256 and secp256k1; toy execution (balance transfers only). Click a node to see the world from its point of view.</p>
        </div>
        <Controls />
      </header>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div className="flex flex-col gap-3">
          <NetworkGraph />
          <ChainView />
          <BlockInspector />
        </div>
        <div className="flex flex-col gap-3">
          <Wallet />
          <NodePanel />
          <RpcConsole />
          <EventLog />
        </div>
      </div>
      <footer className="text-[11px] text-zinc-600">
        Flow: wallet signs → <span className="font-mono">eth_sendRawTransaction</span> to one node → node validates signature and nonce → mempool → gossip to peers → proposer packs a block → block gossips → every node re-executes and checks state root → receipt available via <span className="font-mono">eth_getTransactionReceipt</span>.
      </footer>
    </div>
  );
}
