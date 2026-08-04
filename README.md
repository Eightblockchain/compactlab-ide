# CompactLab IDE

Browser IDE for writing, compiling, and deploying **Compact** contracts on [Midnight](https://midnight.network) Preprod.

## Product modes

| Mode | When | Compile on server | Best for |
|------|------|-------------------|----------|
| **Local lab** | `pnpm dev` | On (if Compact CLI installed) | Full create → Compile → Deploy |
| **Public product** | `NODE_ENV=production` or `COMPACTLAB_PUBLIC=true` | Off unless `COMPACTLAB_ENABLE_COMPILE=true` | Shared Instant Deploy (Hello / Counter) |

See [docs/HOSTING.md](docs/HOSTING.md) for production hosting.

## What works in v1

### A. Instant deploy (no server Compile)
1. Open `/playground` → **Hello, Midnight!** or **Counter** (unedited)
2. Connect **1AM** (Preprod) + [tDUST faucet](https://faucet.preprod.midnight.network/)
3. **Deploy** → **Call** (proofs inside 1AM)
4. **View contract** opens 1AM Preprod explorer

### B. Your own contract
1. **New project** (blank or template) and edit `.compact`
2. **Compile** (needs Compact CLI on the machine / enabled host)
3. Connect 1AM → **Deploy** → **Call**
4. **Export** zip (source + `deployment.json` + managed keys when present)

Edited bundled templates require Compile before Deploy (source fingerprint gate).

## Public product security (v1)

- Signed session cookie (`COMPACTLAB_SESSION_SECRET` required in public mode)
- Rate limits on compile / indexer / artifacts / ZK asset fetches
- Indexer proxy allowlists `contractAction` reads only
- Managed ZK artifacts stored under `.data/` and served at `/api/zk/<id>/…` (not world-static `public/`)
- Server Compile disabled by default in public mode

## Prerequisites

| Dependency | Why |
|---|---|
| Node.js 18+ | App runtime |
| [1AM](https://1am.xyz/) | Sign, submit, ZK prove |
| Preprod tDUST | [Faucet](https://faucet.preprod.midnight.network/) |
| [Compact CLI](https://docs.midnight.network/) | Local / enabled-host Compile only |

## Install & run (local)

```bash
pnpm install
cp .env.example .env.local   # optional
pnpm dev
```

Open [http://localhost:3000/playground](http://localhost:3000/playground).

## Production start

```bash
export COMPACTLAB_SESSION_SECRET="$(openssl rand -hex 32)"
export COMPACTLAB_PUBLIC=true
pnpm build && pnpm start
```

## API routes

| Route | Purpose |
|---|---|
| `GET /api/health` | Mode + compile flag + limits |
| `GET/POST /api/compile` | Compact CLI (gated / rate-limited) |
| `GET /api/zk/[id]/…` | Private managed ZK assets |
| `GET /api/artifacts` | Export helper (rate-limited) |
| `POST /api/indexer` | Allowlisted Preprod GraphQL proxy |

## Manual test script

See [docs/V1_TEST_SCRIPT.md](docs/V1_TEST_SCRIPT.md).

## Tech stack

Next.js 16 · React 19 · Tailwind v4 · Monaco · Zustand · Midnight JS SDK · 1AM proving

## License

MIT
