import { Hex, keccak, recoverAddress, sign, fromHex } from "./crypto";

export const GAS_PER_TX = 21_000;

export interface UnsignedTx {
  from: Hex;
  to: Hex;
  value: number;
  nonce: number;
  gasPrice: number;
}

export interface Tx extends UnsignedTx {
  sig: Hex;
  hash: Hex;
}

/** Canonical serialization. Field order matters — it's what gets hashed. */
export function serializeUnsigned(tx: UnsignedTx): string {
  return JSON.stringify({ from: tx.from, to: tx.to, value: tx.value, nonce: tx.nonce, gasPrice: tx.gasPrice });
}

export const unsignedHash = (tx: UnsignedTx): Hex => keccak(serializeUnsigned(tx));

export function signTx(tx: UnsignedTx, priv: Hex): Tx {
  const sig = sign(unsignedHash(tx), priv);
  const hash = keccak(new Uint8Array([...fromHex(unsignedHash(tx)), ...fromHex(sig)]));
  return { ...tx, sig, hash };
}

export function verifyTx(tx: Tx): { ok: true } | { ok: false; reason: string } {
  try {
    const signer = recoverAddress(unsignedHash(tx), tx.sig);
    if (signer !== tx.from) return { ok: false, reason: `signature recovers to ${signer}, not ${tx.from}` };
  } catch (e) {
    return { ok: false, reason: `bad signature: ${(e as Error).message}` };
  }
  if (!Number.isInteger(tx.value) || tx.value < 0) return { ok: false, reason: "value must be a non-negative integer" };
  if (!Number.isInteger(tx.nonce) || tx.nonce < 0) return { ok: false, reason: "nonce must be a non-negative integer" };
  if (!Number.isInteger(tx.gasPrice) || tx.gasPrice < 1) return { ok: false, reason: "gasPrice must be >= 1" };
  return { ok: true };
}

export const txFee = (tx: UnsignedTx): number => GAS_PER_TX * tx.gasPrice;

/** "Raw transaction" as a wallet would hand to eth_sendRawTransaction: hex-encoded signed payload. */
export function encodeRawTx(tx: Tx): Hex {
  const bytes = new TextEncoder().encode(JSON.stringify(tx));
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export function decodeRawTx(raw: Hex): Tx {
  const bytes = fromHex(raw);
  return JSON.parse(new TextDecoder().decode(bytes)) as Tx;
}
