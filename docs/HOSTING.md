# Hosting CompactLab (separate repos)

Four independent apps / repos:

| Repo | Default local | Prod example |
|------|---------------|--------------|
| `landing-page` | `:3000` | `compactlab.dev` |
| `compactlab` | `:3001` | `play.compactlab.dev` |
| `admin` | `:3002` | `admin.compactlab.dev` |
| `api` | `:4000` | `api.compactlab.dev` |

## Env

**API:** `DATABASE_URL`, `COMPACTLAB_JWT_SECRET`, `CORS_ORIGINS`, `API_PUBLIC_URL`, optional `REDIS_URL`, `S3_*`, `STRIPE_*`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

**Playground / Admin / Landing:** `NEXT_PUBLIC_API_URL`. Landing also uses `NEXT_PUBLIC_PLAYGROUND_URL`.

## Auth

- Landing is public (pricing from `GET /v1/billing/plans`).
- Playground requires user JWT; signup → Free.
- Admin uses separate operator JWT.

## Storage

SQLite file by default in `api`. Redis/S3 optional with local fallbacks.
