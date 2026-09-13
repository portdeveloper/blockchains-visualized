# Blockchains, visualized

An interactive site that teaches how a blockchain works by running a toy one in your browser.

- **Live view** (`/`): a website with a MetaMask-style wallet extension, an RPC, a four-node network, a mempool, and a chain producing a block every 12 seconds. Send a transaction and follow its whole lifecycle. Pan, zoom, and focus on any part for an explanation.
- **Lessons** (`/course`): build a blockchain from scratch, one primitive per step (hash → block → chain → peers).
- **Inspector** (`/playground`): the dense engineering view with a JSON-RPC console and event log.

Real keccak256 and secp256k1 (via `@noble/*`); toy execution (balance transfers only); round-robin proposer standing in for consensus.

## Run

```
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # engine tests (vitest)
```

## Layout

- `src/sim/` — pure TypeScript engine: crypto, tx, state, blocks, nodes, network, consensus, JSON-RPC. No React.
- `src/store/` — zustand stores that drive the engine from requestAnimationFrame.
- `src/components/live/` — the live canvas.
- `src/components/learn/` — lesson widgets.

See `PLAN.md` for the full design.
