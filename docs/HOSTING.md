# Hosting CompactLab (separate repos)

Four independent apps / repos. Step-by-step VPS setup: [DEPLOY_VPS.md](./DEPLOY_VPS.md).

| Repo | Default local | Prod example |
|------|---------------|--------------|
| `landing-page` | `:3000` | `compactlab.dev` |
| `compactlab` | `:3001` | `playground.compactlab.dev` |
| `admin` | `:3002` | `admin.compactlab.dev` |
| `api` | `:4000` | `api.compactlab.dev` |

## Env

**API:** Postgres `DATABASE_URL` (`postgresql://…`), `COMPACTLAB_JWT_SECRET`, `CORS_ORIGINS`, `API_PUBLIC_URL`, `REDIS_URL` (required for fair rate limits), optional `S3_*`, `STRIPE_*`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Apply schema with `pnpm db:migrate:deploy`. To copy a legacy SQLite file: `SQLITE_PATH=./prisma/data/compactlab.db pnpm db:migrate:from-sqlite`.

**Preprod indexer:** Midnight retired its own Preprod indexer on 2026-10-09; Blockfrost hosts it now. Set `BLOCKFROST_PREPROD_PROJECT_ID` (a Midnight Preprod project from blockfrost.io). Every user shares that project's quota (free tier: 50,000 requests per UTC day), so the API proxy caches identical queries for `COMPACTLAB_INDEXER_CACHE_MS` and caps usage with `COMPACTLAB_INDEXER_DAILY_BUDGET` (server, default 45,000) and `COMPACTLAB_INDEXER_PER_USER_DAY` (default 2,000). Raise the budget when you move to a larger Blockfrost plan. Admin → dashboard shows today's usage and warns at `COMPACTLAB_INDEXER_ALERT_PERCENT` (80%). To run your own indexer instead, set `INDEXER_PREPROD_HTTP_URL` and `INDEXER_PREPROD_WS_URL` (and `COMPACTLAB_INDEXER_DAILY_BUDGET=0`). Users who hit a limit can add their own Blockfrost key in Settings (kept in their browser, sent only to Blockfrost) or switch to Preview, whose indexer Midnight still hosts for free.

**Fee sponsorship (off for v1):** protocol matches [example-private-party SPONSORSHIP.md](https://github.com/midnightntwrk/example-private-party/blob/main/docs/SPONSORSHIP.md). To enable later: `COMPACTLAB_ENABLE_SPONSOR=true` plus `COMPACTLAB_SPONSOR_SEED` or `COMPACTLAB_SPONSOR_MNEMONIC`, playground `NEXT_PUBLIC_ENABLE_SPONSORED=1`, and a local proof server on `:6300`. Status must show spendable Dust (`availableCoins >= 1`). See [SPONSORSHIP.md](./SPONSORSHIP.md).

**Billing (off for community v1):** Stripe checkout/portal stay in the API. Set `COMPACTLAB_ENABLE_BILLING=true` and playground `NEXT_PUBLIC_ENABLE_BILLING=1` plus `STRIPE_*` when you want a paid tier.

**Playground / Admin / Landing:** `NEXT_PUBLIC_API_URL`. Landing also uses `NEXT_PUBLIC_PLAYGROUND_URL`.

## Auth

- Landing is public.
- Playground requires user JWT; signup is free for the community.
- Admin uses separate operator JWT.

## Storage

Postgres is required (`DATABASE_URL`). Redis is required for multi-instance rate limits. S3 is optional (local disk fallback for ZK artifacts).

## Scale envelope (v1)

| Dimension | Guidance |
|-----------|----------|
| API replicas | Prefer **1** process with local disk. Set `COMPACTLAB_REPLICAS>1` only with **S3** + shared Redis. |
| Concurrent ZK compiles | Default `COMPACTLAB_COMPILE_CONCURRENCY=1` in production (queue holds the rest). |
| Queue depth | `COMPACTLAB_COMPILE_QUEUE` (default 40 in prod). Excess requests get **429**. |
| Deploy / Call | Client-side via **1AM**; API does not hold on-chain txs open. Capacity follows Preprod + each wallet. |
| Indexer | Preprod reads go through the API proxy and count against the shared Blockfrost quota (estimate: 20–60 requests per active session). Preview and users with their own key bypass it. |
| Artifact URLs | Signed paths `/v1/zk/<id>/a/<token>/…` (unguessable id + HMAC). Recompile after API upgrade if old URLs 403. |

Public/production boot **fails closed** without Postgres, Redis, JWT secret, and a non-default `ADMIN_PASSWORD`. Health returns **503** when DB/Redis/Compact CLI (if compile enabled) are unhealthy.

Compile jobs are **async** (`POST /v1/compile` with `async: true` → poll `GET /v1/compile/jobs/:id`). The Compact CLI runs via non-blocking `spawn` behind a process-wide semaphore.
