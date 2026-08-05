# CompactLab IDE (playground)

Standalone Next.js IDE for Midnight Compact on Preprod. Talks to the sibling **api** service.

## Sibling repos

| Folder | Role | Port |
|--------|------|------|
| `../landing-page` | Marketing site (compactlab.dev) | 3000 |
| `../compactlab` | This playground | 3001 |
| `../admin` | Operator console | 3002 |
| `../api` | Shared `/v1` API | 4000 |

## Run

```bash
# terminal 1 — API
cd ../api && pnpm install && pnpm db:push && pnpm dev

# terminal 2 — playground
cp .env.example .env.local
pnpm install
pnpm dev
```

Open http://localhost:3001 — signup required (Free plan).

Auth, Compile, indexer, and billing all go to `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

See [docs/HOSTING.md](docs/HOSTING.md) and [docs/V1_TEST_SCRIPT.md](docs/V1_TEST_SCRIPT.md).
