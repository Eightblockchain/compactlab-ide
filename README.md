# CompactLab

A browser IDE for [Compact](https://docs.midnight.network/compact), Midnight's smart-contract language. Write a contract, compile it, deploy it and call its circuits from your own wallet, all in one tab, with no local toolchain.

This project is built on the Midnight Network.

The hosted playground will run at [playground.compactlab.dev](https://playground.compactlab.dev) (signup free); until it's live, run it locally as shown below.

## What works today

- **Edit**: Monaco editor with Compact syntax, templates and multi-file projects synced to your account.
- **Compile**: server-side Compact compiler `0.31.1` (language `0.23`). Quick builds skip proving keys; full ZK builds produce everything Deploy needs.
- **Deploy and Call**: on Preprod (default) or Preview, signed by your [1AM](https://1am.xyz) wallet in the browser. Fees are paid from your own tDUST.
- **Read state**: ledger values through the Midnight indexer. Preprod goes through CompactLab's metered proxy, or through your own free Blockfrost key, which you can add in Settings. Preview uses Midnight's public indexer.

Toolchain versions follow the [Midnight support matrix](https://docs.midnight.network/relnotes/support-matrix): ledger 8, compiler 0.31.1, Midnight.js 4.1.1.

## The four apps

CompactLab is four apps that share one API. Each lives in its own folder (and repo):

| Folder | What it is | Local port | Production |
|--------|-----------|-----------|-----------|
| `compactlab` | This repo: the playground IDE (Next.js) | 3001 | playground.compactlab.dev |
| `api` | Hono API: auth, projects, compile queue, indexer proxy, fee sponsor (contract: `openapi.yaml` in the api repo) | 4000 | api.compactlab.dev |
| `admin` | Operator console: flags, plans, users, funnel and indexer usage (Next.js) | 3002 | admin.compactlab.dev |
| `landing-page` | Marketing site and docs (Next.js) | 3000 | compactlab.dev |

The browser apps talk only to the API, through `NEXT_PUBLIC_API_URL`. Contracts are deployed and called from the user's wallet, never by the API.

## Run it locally

You need Node 22+, pnpm, PostgreSQL and Redis. To compile, you also need the [Compact CLI](https://docs.midnight.network/getting-started/installation) on the API host, with the pinned compiler installed (`compact update 0.31.1`). To deploy, you need the 1AM wallet extension with Preprod or Preview funds from the faucet.

Put the four folders side by side:

```
Midnight-Compact-Lab/
  api/  compactlab/  admin/  landing-page/
```

**1. API** (port 4000)

```bash
cd api
cp .env.example .env      # set DATABASE_URL and REDIS_URL
pnpm install
pnpm db:migrate:deploy
pnpm dev
```

To read Preprod state through the shared proxy, set `BLOCKFROST_PREPROD_PROJECT_ID` in `api/.env`. Without it, use Preview or add your own Blockfrost key in the playground's Settings.

**2. Playground** (port 3001)

```bash
cd compactlab
cp .env.example .env.local
pnpm install
pnpm dev
```

Open http://localhost:3001 and sign up.

**3. Admin** (port 3002, optional)

```bash
cd admin
cp .env.example .env.local
pnpm install
pnpm dev
```

Sign in with the admin account the API seeds on first start (see `api/README.md`; change the password).

**4. Landing page** (port 3000, optional)

```bash
cd landing-page
npm install
npm run dev
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test               # vitest
pnpm templates:check    # every template compiles with the pinned compiler
```

## Docs

- [docs/HOSTING.md](docs/HOSTING.md): production setup and the full environment matrix
- [docs/DEPLOY_VPS.md](docs/DEPLOY_VPS.md): putting the API and playground on the VPS (DNS, nginx, PM2, deploy workflow)
- [docs/SPONSORSHIP.md](docs/SPONSORSHIP.md): sponsored DUST fees (off until a funded sponsor wallet is verified)
- [docs/V1_TEST_SCRIPT.md](docs/V1_TEST_SCRIPT.md): manual end-to-end test
- [CONTRIBUTING.md](CONTRIBUTING.md): how to contribute

## License

[MIT](LICENSE)
