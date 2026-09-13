import { keccak_256 } from "@noble/hashes/sha3.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/** 0x-prefixed lowercase hex string. */
export type Hex = string;

export const toHex = (b: Uint8Array): Hex => "0x" + bytesToHex(b);
export const fromHex = (h: Hex): Uint8Array => hexToBytes(h.startsWith("0x") ? h.slice(2) : h);
export const keccak = (data: Uint8Array | string): Hex =>
  toHex(keccak_256(typeof data === "string" ? utf8ToBytes(data) : data));

export interface Keypair {
  priv: Hex;
  pub: Hex; // uncompressed, 65 bytes
  address: Hex; // 20 bytes
}

export function addressFromPub(pubUncompressed: Uint8Array): Hex {
  // Ethereum: keccak256 of the 64-byte public key (drop 0x04 prefix), take last 20 bytes.
  return toHex(keccak_256(pubUncompressed.slice(1)).slice(12));
}

export function keypairFromPriv(priv: Uint8Array): Keypair {
  const pub = secp256k1.getPublicKey(priv, false);
  return { priv: toHex(priv), pub: toHex(pub), address: addressFromPub(pub) };
}

/** Sign a 32-byte hash. Returns 65-byte recoverable signature (r ‖ s ‖ v). */
export function sign(msgHash: Hex, priv: Hex): Hex {
  const sig = secp256k1.sign(fromHex(msgHash), fromHex(priv), { prehash: false, format: "recovered" });
  return toHex(sig);
}

/** Recover the signer's address from a hash and a recoverable signature. */
export function recoverAddress(msgHash: Hex, sig: Hex): Hex {
  const compressed = secp256k1.recoverPublicKey(fromHex(sig), fromHex(msgHash), { prehash: false });
  const uncompressed = secp256k1.Point.fromBytes(compressed).toBytes(false);
  return addressFromPub(uncompressed);
}

export const short = (h: Hex, n = 4): string => (h.length > 2 + 2 * n ? `${h.slice(0, 2 + n)}…${h.slice(-n)}` : h);
