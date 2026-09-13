import { Hex, keccak, fromHex } from "./crypto";

/** Simple binary Merkle root over leaf hashes. Odd leaf is duplicated. */
export function merkleRoot(leaves: Hex[]): Hex {
  if (leaves.length === 0) return keccak("");
  let level = leaves;
  while (level.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] ?? level[i];
      next.push(keccak(new Uint8Array([...fromHex(a), ...fromHex(b)])));
    }
    level = next;
  }
  return level[0];
}
