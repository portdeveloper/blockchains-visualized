import { Hex, keccak } from "./crypto";
import { merkleRoot } from "./merkle";
import { Receipt } from "./state";
import { Tx } from "./tx";

export interface BlockHeader {
  number: number;
  parentHash: Hex;
  timestamp: number;
  proposer: Hex;
  txRoot: Hex;
  stateRoot: Hex;
}

export interface Block {
  header: BlockHeader;
  hash: Hex;
  txs: Tx[];
  receipts: Receipt[];
}

export const headerHash = (h: BlockHeader): Hex =>
  keccak(JSON.stringify({ number: h.number, parentHash: h.parentHash, timestamp: h.timestamp, proposer: h.proposer, txRoot: h.txRoot, stateRoot: h.stateRoot }));

export const txRootOf = (txs: Tx[]): Hex => merkleRoot(txs.map((t) => t.hash));
