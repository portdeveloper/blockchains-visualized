import { keccak } from "@/sim/crypto";

export const DIFFICULTY = "0000";

export interface SimpleBlock {
  number: number;
  nonce: number;
  data: string;
  prev: string;
}

export const blockHash = (b: SimpleBlock) => keccak(`${b.number}|${b.nonce}|${b.data}|${b.prev}`);
export const isMined = (hash: string) => hash.startsWith("0x" + DIFFICULTY);

/** Brute-force a nonce until the hash meets the difficulty. Returns nonce and attempts. */
export function mine(b: SimpleBlock): { nonce: number; attempts: number } {
  let nonce = 0;
  for (;;) {
    if (isMined(blockHash({ ...b, nonce }))) return { nonce, attempts: nonce + 1 };
    nonce++;
  }
}

export const ZERO = "0x" + "0".repeat(64);
