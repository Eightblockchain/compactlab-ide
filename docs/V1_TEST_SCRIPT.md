# CompactLab v1 manual test script

Run on a machine with Compact CLI and **1AM**. Goal: complete the happy path in under 15 minutes.

No Docker proof server is required — ZK proving runs in 1AM.

## Prep

1. `pnpm install && pnpm dev`
2. Install [1AM](https://1am.xyz/); unlock; select Midnight **Preprod**
3. Fund tDUST: https://faucet.preprod.midnight.network/
4. Compact CLI on PATH (`compact --version`) for Compile cases

## Cases

### 1. Connect 1AM

- Click **Connect 1AM**
- Approve in the extension
- Expect: address chip in the topbar; status shows Prove 1AM

### 2. Reject non-1AM

- If only Lace is installed (no 1AM): expect install/connect error pointing to https://1am.xyz/
- Lace must not appear as a supported wallet in v1

### 3. Hello World Deploy + Call (instant path)

1. Open **Hello, Midnight!** (do not edit source)
2. Connect 1AM + tDUST
3. **Deploy** — must work **without** Compact CLI on public hosts
4. Contract UI → Call `storeMessage` with `"hi"`
5. Click **View contract** → 1AM explorer opens

### 3b. Public host Compile gate

- With default public config, **Compile** returns disabled / 403
- Hello Instant Deploy still works
- With `COMPACTLAB_ENABLE_COMPILE=true` + CLI, Compile is rate-limited

### 4. Counter Deploy + Call

Same as (3) with Counter → `increment` / `incrementBy`

### 5. Edit requires Compile

1. Open Hello World, change the message circuit body or a comment meaningfully… better: change ledger/circuit source so fingerprint differs
2. Expect **Deploy** disabled / error: run Compile first
3. **Compile** (full ZK) → Deploy enabled again → Deploy succeeds against managed artifacts

### 6. New project from scratch

1. **New project** → Blank (or Voting)
2. Edit / keep template source
3. **Compile** → **Deploy** → **Call**

### 7. Export

1. After deploy, click **Export**
2. Expect a `.zip` with source, `deployment.json` (address filled), and `COMPACTLAB_EXPORT.md`
3. If Compile ran on this machine, zip includes `contracts/managed/` binaries

### 8. Refresh keeps deploy state

1. Deploy Hello, note address in Contract UI
2. Hard refresh the browser
3. Expect address / deploy result still visible without switching projects

### 9. No Docker dependency

- Ensure nothing listens on `:6300`
- Deploy hello-world still succeeds with 1AM connected

### 10. Witness template (optional)

- Bulletin Board: Compile (ZK), Deploy, set `localSecretKey`, `post`, then `takeDown` with the **same** key

## Pass criteria

- [ ] 1AM connect works
- [ ] Hello + Counter Deploy + Call without Docker
- [ ] Hello Instant Deploy works without Compact CLI (public host)
- [ ] Edited source blocks Deploy until Compile
- [ ] Blank/template → Compile → Deploy works (local or ENABLE_COMPILE)
- [ ] Export zip downloads
- [ ] Refresh restores deploy/compile state
- [ ] Clear error if 1AM missing
- [ ] Public host: `/api/health` shows mode=public; Compile disabled by default
- [ ] Public host: indexer rejects non-allowlisted GraphQL
- [ ] `COMPACTLAB_SESSION_SECRET` required when public (API 503 if missing)
