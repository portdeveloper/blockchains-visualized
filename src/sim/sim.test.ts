import { describe, expect, it } from "vitest";
import { Simulation } from "./sim";
import { encodeRawTx, signTx, verifyTx } from "./tx";
import { headerHash } from "./block";

describe("simulation", () => {
  it("is deterministic for a given seed", () => {
    const a = new Simulation({ seed: 7 });
    const b = new Simulation({ seed: 7 });
    expect(a.accounts[0].address).toBe(b.accounts[0].address);
    expect(a.genesis.hash).toBe(b.genesis.hash);
  });

  it("propagates a tx, mines it, and all nodes converge", () => {
    const sim = new Simulation({ seed: 1, nodeCount: 5, blockTimeMs: 2000 });
    const tx = sim.buildAndSign(0, sim.accounts[1].address, 500, 1, 0);
    const res = sim.rpc(0, { method: "eth_sendRawTransaction", params: [encodeRawTx(tx)] });
    expect(res.result).toBe(tx.hash);
    sim.step(1500);
    expect(sim.nodes.every((n) => n.mempool.has(tx.hash))).toBe(true);
    sim.step(4000);
    for (const n of sim.nodes) {
      expect(n.head().header.number).toBeGreaterThanOrEqual(1);
      expect(n.receipts.get(tx.hash)?.status).toBe("success");
      expect(n.state.get(sim.accounts[1].address).balance).toBe(1_000_000 + 500);
    }
    const heads = new Set(sim.nodes.map((n) => n.head().hash));
    expect(heads.size).toBe(1);
  });

  it("rejects a tampered tx", () => {
    const sim = new Simulation({ seed: 1 });
    const tx = sim.buildAndSign(0, sim.accounts[1].address, 500, 1, 0);
    const tampered = { ...tx, value: 999_999 };
    expect(verifyTx(tampered).ok).toBe(false);
  });

  it("nodes reject a block whose header was tampered with", () => {
    const sim = new Simulation({ seed: 1, nodeCount: 3 });
    sim.step(4000);
    const block = sim.nodes[0].head();
    const fake = { ...block, header: { ...block.header, timestamp: 1 } };
    expect(headerHash(fake.header)).not.toBe(fake.hash);
    expect(sim.nodes[1].validateBlock(fake).ok).toBe(false);
  });

  it("includes a failed tx and still charges gas", () => {
    const sim = new Simulation({ seed: 3, nodeCount: 3, initialBalance: 50_000 });
    // fee = 21000 * 1; value larger than remaining balance → included, failed
    const tx = sim.buildAndSign(0, sim.accounts[1].address, 40_000, 1, 0);
    sim.rpc(0, { method: "eth_sendRawTransaction", params: [encodeRawTx(tx)] });
    sim.step(6000);
    const r = sim.nodes[0].receipts.get(tx.hash);
    expect(r?.status).toBe("failed");
    expect(sim.nodes[0].state.get(sim.accounts[0].address).balance).toBe(50_000 - 21_000);
  });

  it("signature round-trips", () => {
    const sim = new Simulation({ seed: 9 });
    const kp = sim.accounts[0];
    const tx = signTx({ from: kp.address, to: kp.address, value: 1, nonce: 0, gasPrice: 1 }, kp.priv);
    expect(verifyTx(tx).ok).toBe(true);
  });
});
