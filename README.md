# CompactLab IDE

Browser-based IDE for writing, compiling, and deploying **Compact** smart contracts on [Midnight](https://midnight.network) Preprod.

## What works in v1

End-to-end on Midnight Preprod for **hello-world** and **counter** (bundled ZK assets):

1. Open `/playground`
2. Compile with the local Compact CLI (`--skip-zk` typecheck, or **Compile (ZK)** for deployable keys from your edits)
3. Connect **Lace** (Preprod) and fund tDUST from the [faucet](https://faucet.preprod.midnight.network/)
4. Ensure Docker proof server is running (auto-started from Deploy, or see below)
5. **Deploy** → real contract address
6. **Contract UI** → call circuits (`storeMessage`, `increment`, …) and read state via indexer

Other templates are **compile-only** educational samples until you run **Compile (ZK)** for that project.

### Limitation

- Default **Compile** uses `--skip-zk` (syntax/typecheck). Bundled deploy still uses precompiled assets under `public/contracts/<template>/` unless you run **Compile (ZK)**, which writes artifacts to `public/contracts/managed/<projectId>/` and wires Deploy/Call to those assets.

## Prerequisites

| Dependency | Why |
|---|---|
| [Node.js 18+](https://nodejs.org/) | App runtime |
| [Compact CLI](https://docs.midnight.network/) (`compact` on PATH) | Real compile |
| [Docker](https://docker.com) + `midnightntwrk/proof-server` | ZK prove/check |
| [Lace](https://lace.io) with Midnight | Sign + submit txs |
| Preprod tDUST | [Faucet](https://faucet.preprod.midnight.network/) |

### Proof server

```bash
docker run -d --rm -p 6300:6300 --name compactlab-proof-server midnightntwrk/proof-server
```

The IDE can also start it via `POST /api/proof/start` when you Deploy.

## Install & run

```bash
pnpm install   # or npm install
pnpm dev
```

Open [http://localhost:3000/playground](http://localhost:3000/playground).

## API routes

| Route | Purpose |
|---|---|
| `GET/POST /api/compile` | Compact CLI compile (`zk: true` for full keys). Returns **503** if CLI missing. |
| `GET /api/proof/health` | Proof server reachability |
| `POST /api/proof/start` | Start Docker proof-server |
| `POST /api/proof/prove` | Proxy prove → `:6300` |
| `POST /api/proof/check` | Proxy check → `:6300` |
| `POST /api/indexer` | Preprod GraphQL indexer proxy (CORS) |

Projects persist in browser localStorage (Zustand). There is no Prisma/cloud backend in v1.

## Manual test script (v1 gate)

See [docs/V1_TEST_SCRIPT.md](docs/V1_TEST_SCRIPT.md).

## Tech stack

Next.js 16 · React 19 · Tailwind v4 · Monaco · Zustand · Midnight JS SDK

## License

MIT
