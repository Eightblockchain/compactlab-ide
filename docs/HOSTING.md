# Hosting CompactLab as a shared public product

CompactLab can run as a **public Preprod playground**. That is different from an unbounded multi-tenant SaaS with free unlimited ZK compile.

## What “public product” means in v1

| Feature | Public default | Notes |
|---------|----------------|-------|
| Hello / Counter Instant Deploy | **On** | Bundled ZK keys under `/contracts/hello-world` and `/contracts/counter` |
| Call + Contract UI + 1AM explorer links | **On** | Needs 1AM + Preprod tDUST |
| Server Compact CLI Compile | **Off** | Set `COMPACTLAB_ENABLE_COMPILE=true` only on a hardened worker |
| Managed keys | Private `.data/` via `/api/zk/<id>/…` | Not world-listed under `public/` |
| Indexer proxy | Allowlisted + rate-limited | `contractAction` hex address only |
| Session | Signed httpOnly cookie | Requires `COMPACTLAB_SESSION_SECRET` |

## Required env (production)

```bash
NODE_ENV=production
COMPACTLAB_PUBLIC=true
COMPACTLAB_SESSION_SECRET=<long-random-string>
# Optional: enable compile on a dedicated worker
# COMPACTLAB_ENABLE_COMPILE=true
```

Without `COMPACTLAB_SESSION_SECRET`, API routes return **503** in public mode.

## Deploy checklist

1. `pnpm install && pnpm build && pnpm start`
2. Put TLS in front (Vercel / Fly / nginx)
3. Set secrets above
4. Do **not** mount or publish `.data/` as static files
5. Prefer Instant Deploy only unless you intentionally run Compact CLI on the server
6. Monitor disk if compile is enabled (ZK outputs are large)
7. Run [docs/V1_TEST_SCRIPT.md](./V1_TEST_SCRIPT.md) against the public URL

## Security model (honest)

- Rate limits are **in-memory per process** — use a single instance or put Redis/edge rate limiting in front for multi-instance.
- Managed artifact URLs use unguessable project ids + private storage, but anyone who obtains a URL can fetch keys (needed for wallet proving). Treat ids as secrets.
- Witness values still live in the user’s browser localStorage — never log them server-side.
- There is no end-user login (Google/GitHub). Quotas are per signed anonymous session + IP.

## Enabling server Compile safely

Only if you accept CPU/disk cost:

1. Install Compact CLI on the host
2. `COMPACTLAB_ENABLE_COMPILE=true`
3. Lower `COMPACTLAB_ZK_COMPILE_PER_HOUR` (default 3 in public mode)
4. Cap disk for `COMPACTLAB_DATA_DIR`
5. Prefer a separate compile worker, not the same machine as marketing traffic

## Health

`GET /api/health` → `{ mode, compileEnabled, rateLimits }`
