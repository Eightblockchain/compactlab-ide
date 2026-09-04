# Hosting CompactLab (separate repos)

Four independent apps / repos:

| Repo | Default local | Prod example |
|------|---------------|--------------|
| `landing-page` | `:3000` | `compactlab.dev` |
| `compactlab` | `:3001` | `play.compactlab.dev` |
| `admin` | `:3002` | `admin.compactlab.dev` |
| `api` | `:4000` | `api.compactlab.dev` |

## Env

**API:** Postgres `DATABASE_URL` (`postgresql://…`), `COMPACTLAB_JWT_SECRET`, `CORS_ORIGINS`, `API_PUBLIC_URL`, `REDIS_URL` (required for fair rate limits), optional `S3_*`, `STRIPE_*`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Apply schema with `pnpm db:migrate:deploy`. To copy a legacy SQLite file: `SQLITE_PATH=./prisma/data/compactlab.db pnpm db:migrate:from-sqlite`.

**Fee sponsorship (off for v1):** protocol matches [example-private-party SPONSORSHIP.md](https://github.com/midnightntwrk/example-private-party/blob/main/docs/SPONSORSHIP.md). To enable later: `COMPACTLAB_ENABLE_SPONSOR=true` plus `COMPACTLAB_SPONSOR_SEED` or `COMPACTLAB_SPONSOR_MNEMONIC`, playground `NEXT_PUBLIC_ENABLE_SPONSORED=1`, and a local proof server on `:6300`. Status must show spendable Dust (`availableCoins >= 1`). See [SPONSORSHIP.md](./SPONSORSHIP.md).

**Billing (off for community v1):** Stripe checkout/portal stay in the API. Set `COMPACTLAB_ENABLE_BILLING=true` and playground `NEXT_PUBLIC_ENABLE_BILLING=1` plus `STRIPE_*` when you want a paid tier.

**Playground / Admin / Landing:** `NEXT_PUBLIC_API_URL`. Landing also uses `NEXT_PUBLIC_PLAYGROUND_URL`.

## Auth

- Landing is public.
- Playground requires user JWT; signup is free for the community.
- Admin uses separate operator JWT.

## Storage

Postgres is required (`DATABASE_URL`). Redis is required for multi-instance rate limits. S3 is optional (local disk fallback for ZK artifacts).
