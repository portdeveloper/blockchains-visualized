import { Node } from "./node";
import { Network } from "./network";
import { SimEvent } from "./node";
import { decodeRawTx } from "./tx";
import { Hex } from "./crypto";

export type BlockTag = "latest" | "pending" | number | string;

export interface RpcRequest {
  method: string;
  params: unknown[];
}
export interface RpcResponse {
  result?: unknown;
  error?: { code: number; message: string };
}

export const RPC_METHODS = [
  "eth_blockNumber",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_sendRawTransaction",
  "eth_getBlockByNumber",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "txpool_content",
  "net_peerCount",
] as const;

function resolveBlock(node: Node, tag: BlockTag) {
  if (tag === "latest" || tag === "pending" || tag === undefined) return node.head();
  const n = typeof tag === "string" ? parseInt(tag, tag.startsWith("0x") ? 16 : 10) : tag;
  return node.chain[n];
}

const hexNum = (n: number) => "0x" + n.toString(16);

/**
 * JSON-RPC handler. An RPC is nothing magic: it's a function that reads one node's local view
 * (its chain, its state, its mempool) and answers. Different nodes can give different answers.
 */
export function handleRpc(node: Node, req: RpcRequest, now: number, net: Network, log: SimEvent[]): RpcResponse {
  if (!node.online) return { error: { code: -32000, message: "connection refused: node is offline" } };
  const [p0, p1] = req.params;
  try {
    switch (req.method) {
      case "eth_blockNumber":
        return { result: hexNum(node.head().header.number) };
      case "net_peerCount":
        return { result: hexNum(node.peers.length) };
      case "eth_getBalance": {
        const addr = String(p0).toLowerCase() as Hex;
        const tag = (p1 ?? "latest") as BlockTag;
        if (tag === "pending") {
          // Pending = latest state + mempool txs applied optimistically. Simplified: just report latest here.
          return { result: hexNum(node.state.get(addr).balance) };
        }
        const b = resolveBlock(node, tag);
        if (!b) return { error: { code: -32000, message: "unknown block" } };
        if (b.header.number !== node.head().header.number) return { error: { code: -32000, message: "historical state not available (toy node keeps only latest state)" } };
        return { result: hexNum(node.state.get(addr).balance) };
      }
      case "eth_getTransactionCount": {
        const addr = String(p0).toLowerCase() as Hex;
        const tag = (p1 ?? "latest") as BlockTag;
        let nonce = node.state.get(addr).nonce;
        if (tag === "pending") {
          for (const tx of node.mempool.values()) if (tx.from === addr && tx.nonce >= nonce) nonce = tx.nonce + 1;
        }
        return { result: hexNum(nonce) };
      }
      case "eth_sendRawTransaction": {
        const tx = decodeRawTx(String(p0));
        const r = node.receiveTx(tx, "rpc", now, net, log);
        if (!r.ok) return { error: { code: -32000, message: r.reason ?? "rejected" } };
        return { result: tx.hash };
      }
      case "eth_getBlockByNumber": {
        const b = resolveBlock(node, p0 as BlockTag);
        if (!b) return { result: null };
        return { result: { ...b.header, hash: b.hash, transactions: p1 ? b.txs : b.txs.map((t) => t.hash) } };
      }
      case "eth_getTransactionByHash": {
        const h = String(p0) as Hex;
        const mined = node.txIndex.get(h);
        if (mined) return { result: { ...mined, blockNumber: node.receipts.get(h)?.blockNumber } };
        const pending = node.mempool.get(h);
        if (pending) return { result: { ...pending, blockNumber: null } };
        return { result: null };
      }
      case "eth_getTransactionReceipt":
        return { result: node.receipts.get(String(p0) as Hex) ?? null };
      case "txpool_content":
        return { result: { pending: [...node.mempool.values()] } };
      default:
        return { error: { code: -32601, message: `method ${req.method} not found` } };
    }
  } catch (e) {
    return { error: { code: -32602, message: `invalid params: ${(e as Error).message}` } };
  }
}
