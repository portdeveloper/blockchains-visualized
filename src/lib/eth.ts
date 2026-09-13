/**
 * Units. The engine counts in whole gwei (1 gwei = 1e-9 ETH) so every balance is a JS-safe integer:
 * 10 ETH = 10_000_000_000 gwei, far below 2^53. Real Ethereum counts in wei (1e-18), which needs bigint.
 */
export const GWEI = 1;
export const ETH = 1_000_000_000;

/** Format a gwei amount as ETH, e.g. 10_000_000_000 → "10 ETH", 42_000 → "0.000042 ETH". */
export function fmtEth(gwei: number, opts: { unit?: boolean; digits?: number } = {}): string {
  const { unit = true, digits } = opts;
  const eth = gwei / ETH;
  const max = digits ?? (Math.abs(eth) >= 1 ? 4 : 6);
  const s = eth.toLocaleString("en-US", { maximumFractionDigits: max, minimumFractionDigits: 0 });
  return unit ? `${s} ETH` : s;
}

export const fmtGwei = (gwei: number) => `${gwei.toLocaleString("en-US")} gwei`;

/** Parse a user-typed ETH amount ("0.1") into whole gwei. */
export const parseEth = (s: string): number => Math.max(0, Math.round((parseFloat(s) || 0) * ETH));

/** Signed delta, e.g. "+0.1 ETH" / "−0.000042 ETH". */
export const fmtDelta = (gwei: number) => (gwei > 0 ? "+" : gwei < 0 ? "−" : "") + fmtEth(Math.abs(gwei));
