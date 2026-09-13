import { Hex } from "./crypto";

/**
 * Toy "smart contracts". Not an EVM: each contract type is a small TypeScript program with
 * named methods operating on a per-contract storage object. The mechanics are the real ones:
 * code lives at an address, calls are transactions with a data field, every node runs the same
 * code and gets the same storage, view methods are free reads, state-changing calls pay gas,
 * failures revert and still pay.
 */
export interface Log {
  event: string;
  args: Record<string, string | number>;
}

export interface CallCtx {
  sender: Hex;
  storage: Record<string, unknown>;
  emit: (log: Log) => void;
}

export interface ContractType {
  name: string;
  init: (ctx: CallCtx, args: unknown[]) => void;
  methods: Record<string, { view: boolean; run: (ctx: CallCtx, args: unknown[]) => unknown }>;
}

interface TokenStorage { name: string; symbol: string; totalSupply: number; balances: Record<Hex, number> }
const tok = (s: Record<string, unknown>) => s as unknown as TokenStorage;

export const CONTRACTS: Record<string, ContractType> = {
  token: {
    name: "Token",
    init: (ctx, [name, symbol, supply]) => {
      const s = tok(ctx.storage);
      s.name = String(name); s.symbol = String(symbol); s.totalSupply = Number(supply);
      s.balances = { [ctx.sender]: Number(supply) };
      ctx.emit({ event: "Transfer", args: { from: "0x0", to: ctx.sender, amount: Number(supply) } });
    },
    methods: {
      transfer: { view: false, run: (ctx, [to, amount]) => {
        const s = tok(ctx.storage); const a = Number(amount); const t = String(to).toLowerCase();
        if (!Number.isInteger(a) || a <= 0) throw new Error("amount must be a positive integer");
        if ((s.balances[ctx.sender] ?? 0) < a) throw new Error(`insufficient ${s.symbol}: have ${s.balances[ctx.sender] ?? 0}, need ${a}`);
        s.balances[ctx.sender] -= a; s.balances[t] = (s.balances[t] ?? 0) + a;
        ctx.emit({ event: "Transfer", args: { from: ctx.sender, to: t, amount: a } });
        return true;
      } },
      balanceOf: { view: true, run: (ctx, [addr]) => tok(ctx.storage).balances[String(addr).toLowerCase()] ?? 0 },
      totalSupply: { view: true, run: (ctx) => tok(ctx.storage).totalSupply },
      symbol: { view: true, run: (ctx) => tok(ctx.storage).symbol },
      name: { view: true, run: (ctx) => tok(ctx.storage).name },
    },
  },
};

export interface DeployData { deploy: string; args: unknown[] }
export interface CallData { method: string; args: unknown[] }
export const encodeData = (d: DeployData | CallData): string => JSON.stringify(d);
export const decodeData = (s: string): DeployData | CallData => JSON.parse(s);
export const isDeploy = (d: DeployData | CallData): d is DeployData => "deploy" in d;
