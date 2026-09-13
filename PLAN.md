# Blockchains Visualized — Plan

## Thesis

One simulated network, running in the browser, that every lesson looks at through a different lens.
Not eight separate demos. The learner watches the *same* nodes, mempool, and chain from chapter 1
to chapter 8, and each chapter switches on one more component. By the end they can trace a single
transaction from "click send" to "receipt in wallet" across every layer.

## Audience and scope

- Audience: developers and technically curious people new to blockchains. Not children, not PhDs.
- Model: EVM-style account model (addresses, nonces, balances, gas). Terminology matches Ethereum/Monad.
- Execution: toy state machine, balance transfers only. **No EVM.** Contracts are an optional later chapter.
- Consensus: one model taught properly — proof-of-stake with a rotating proposer and validator votes.
  PoW gets a short historical aside, not a full simulation.
- Cryptography is real (keccak256, secp256k1 via `@noble/*`). "Edit one byte, watch every downstream
  hash break" only lands if the hashes are real.

## Curriculum

Each chapter = short prose (MDX) + one or two interactive widgets bound to the shared simulation.

| # | Chapter | Component revealed | Key interaction |
|---|---------|--------------------|-----------------|
| 1 | Transactions | tx | Build a tx field by field, sign it, see hash/signature change live |
| 2 | Accounts & wallets | state (address → balance, nonce) | Generate keypair, derive address, see nonce gate ordering |
| 3 | Nodes & the mempool | nodes, p2p gossip | Submit tx to one node, watch propagation with latency; kill a node |
| 4 | Blocks | block, header, hash chain | Tamper with a tx in block N, see N+1… invalidate; Merkle root demo |
| 5 | Consensus | proposer rotation, votes, forks, finality | Partition network, create fork, heal, watch fork choice resolve |
| 6 | Execution & state | state transition | Step through a block tx-by-tx, balances/nonces update, failed tx still pays gas |
| 7 | RPCs | JSON-RPC interface | Live console: `eth_getBalance`, `eth_sendRawTransaction`, `eth_getBlockByNumber`, `eth_getTransactionReceipt`, `eth_call`; see which node answered and what state it read; `pending` vs `latest` |
| 8 | End to end | everything | Scrubbable timeline: wallet → RPC → mempool → gossip → proposer → block → votes → execution → receipt → wallet |

Later (not in v1): smart contracts, gas market / EIP-1559, light clients, MEV, parallel execution.

## Playground

Free-running sandbox with the full network and controls: add/kill node, partition, block time,
tx spam rate, latency. Click any entity for an inspector (block header, node's local chain view
and mempool, tx status). This is where the "how it fits together" payoff is.

## Architecture

```
src/
  sim/            pure TypeScript, no React, deterministic (seeded RNG), tick()-driven
    crypto.ts     keccak256, secp256k1 sign/verify, address derivation
    tx.ts         Tx type, serialize, hash, sign, validate
    state.ts      Map<address, {balance, nonce}>, applyTx, applyBlock
    block.ts      header (parent, number, timestamp, txRoot, stateRoot), hash
    merkle.ts     tx root
    node.ts       local chain, mempool, peers, message handlers
    network.ts    message bus with per-link latency and partitions
    consensus.ts  proposer rotation, votes, fork choice, finality
    rpc.ts        JSON-RPC handler: method → node's view
    sim.ts        Simulation class: nodes + network + clock; step(), snapshot()
  store/          zustand store wrapping one Simulation instance; emits snapshots to React
  components/
    viz/          NetworkGraph (SVG), ChainView, MempoolView, BlockInspector, TxBuilder,
                  RpcConsole, StateTable, Timeline
    lesson/       MDX wrappers, chapter nav, callouts
  app/
    learn/[chapter]/   MDX chapters with embedded widgets
    playground/
```

- Stack: Next.js (App Router, static export — no server needed), TypeScript, Tailwind, Zustand,
  framer-motion for transitions, SVG for diagrams (DOM-interactive, easy click targets).
- Engine is decoupled from React so it can be unit-tested and driven by a timeline scrubber
  (replay from seed + event log).
- Tests: vitest on `sim/` — hash chain integrity, nonce ordering, fork choice, RPC responses.

## Phases

0. **Engine + tests.** Everything depends on it. ~ tx, state, block, node, network, consensus, rpc.
1. **Chapters 1, 2, 4.** Highest payoff per effort; mostly single-node.
2. **Chapters 3, 5, 6.** Multi-node, gossip, forks.
3. **Chapters 7, 8.** RPC console and the end-to-end timeline.
4. **Playground, polish, deploy** (Vercel static).

## Risks

- **Scope creep toward a real EVM.** Hard line: balance transfers only in v1.
- **Consensus fidelity.** Simplified PoS must still be *correct* in what it claims. Review the
  model with someone who knows BFT before writing chapter 5 prose.
- **Animation vs. accuracy.** Gossip/latency animations must be driven by the engine's actual
  message log, never faked, or the playground will lie.
- **Performance.** SVG is fine up to ~20 nodes / few hundred txs. Cap the playground there.

## Assumptions to confirm

- EVM-flavored terminology (Ethereum/Monad) rather than chain-agnostic.
- PoS as the single consensus model taught.
- Developer-ish audience.
