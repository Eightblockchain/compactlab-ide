# CompactLab v1 manual test script

Run on a machine with Compact CLI, Docker, and Lace. Goal: complete the happy path in under 15 minutes.

## Prep

1. `pnpm install && pnpm dev`
2. Install Lace; enable Midnight Preprod
3. Fund wallet: https://faucet.preprod.midnight.network/
4. Optional: `docker run -d --rm -p 6300:6300 midnightntwrk/proof-server`

## Cases

### 1. Compact CLI missing → hard fail

- Temporarily rename `compact` off PATH
- Click **Compile**
- Expect: error in Compile tab / logs with install hint — **no** green mock success

### 2. Compact CLI present → real compile

- Restore `compact`
- Open Hello, Midnight!
- Click **Compile**
- Expect: success with `mock: false`, circuit list, optional generated files under `contracts/managed/`

### 3. Proof server down → clear Deploy error

- Stop Docker proof container if running
- With Lace connected, click **Deploy** on hello-world
- Expect: logs explain Docker requirement / start failure (not a fake deploy address)

### 4. Full deploy + call + read (hello-world)

1. Proof server healthy (or let Deploy auto-start)
2. Lace connected + tDUST
3. **Deploy** → real Preprod address in Network tab + Contract UI
4. Call `storeMessage` with `"hi"` → real `txId`
5. Refresh on-chain state → message shows `hi`

### 5. Counter deployable

1. Open or create **Counter** template
2. Deploy → address
3. Call `increment()` → tx succeeds
4. State / decoded `round` increases

### 6. Non-deployable template

1. Create project from **Voting** (or similar)
2. Expect: **Deploy** disabled (tooltip explains)
3. Compile still works with CLI

### 7. Compile (ZK) edit→chain (v1.1 path)

1. Edit hello-world Compact source (e.g. comment change is not enough — prefer a visible ledger behavior change if testing semantics)
2. Click **Compile (ZK)** — wait for artifacts at `/contracts/managed/<projectId>/`
3. **Deploy** — logs should say “Using project ZK artifacts…”
4. Call circuit and confirm on-chain behavior

## Pass criteria

All cases 1–6 pass. Case 7 is the edit→chain gate for v1.1.
