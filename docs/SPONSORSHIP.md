# DUST fee sponsorship — what the authors specify, and CompactLab v1

Source of truth: [Midnight example-private-party SPONSORSHIP.md](https://github.com/midnightntwrk/example-private-party/blob/main/docs/SPONSORSHIP.md).

## How fees work on Midnight (authors)

Transaction fees are paid in **DUST**, not NIGHT. DUST is **not transferable**. It is *generated* by NIGHT held under a public key that has been **registered for DUST generation**. The ledger Registration Table links a NIGHT key to a DUST key; a DUST UTXO appears only when a NIGHT UTXO is created *and* that key is in the table.

Consequence: a wallet can hold plenty of NIGHT and still be unable to submit anything. Unregistered NIGHT generates no DUST, so there is no fee to offer.

**Fee sponsorship** splits *who is authorized to act* from *who pays the fee*.

| Party | Method | `tokenKindsToBalance` | Pays for |
| --- | --- | --- | --- |
| User | `balanceUnboundTransaction` | `['shielded', 'unshielded']` | their own value |
| Sponsor | `balanceFinalizedTransaction` | `['dust']` | the transaction fee |

**Order is the security argument.** The user proves, balances their value, signs, and **finalizes (binds)** first. The sponsor receives a bound `FinalizedTransaction` and can only attach a DUST fee offer. The sponsor never sees circuit private inputs.

Units: 1 DUST = 10¹⁵ SPECK. The sponsor must have **spendable DUST coins**, not merely synced-to-tip with a zero balance (`wait-for-dust.ts` waits for `dust.availableCoins.length >= 1`).

Adapting to a DApp (authors):

- The **user** needs a proof server / proving wallet and their private inputs. They do **not** need DUST.
- The **sponsor** needs NIGHT that is **registered for DUST generation**. Plain NIGHT is not enough.
- Authenticate and rate-limit the sponsor HTTP endpoint.
- Sponsorship covers **fees only**, not contract value transfers.

## How CompactLab implemented it

1. **User (browser / 1AM):** prove locally via `getProvingProvider`, then `balanceUnsealedTransaction({ payFees: false })` so the user’s Dust is not spent. The bound hex is `POST`ed to `/v1/sponsor`.
2. **Sponsor (API):** `Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature','proof','binding', …)` then `balanceFinalizedTransaction({ tokenKindsToBalance: ['dust'] })`, sign, finalize, submit.

That split matches the reference `prepareSponsoredCall` / `sponsorAndSubmit` in example-private-party.

## Issues we hit (why Sponsored is off for v1)

These are operational, not a misunderstanding of the protocol:

1. **Wrong “still syncing” signal.** `waitForSyncedState()` / `progress.isStrictlyComplete()` means “caught up to chain tip”, not “has funds”. Preprod Dust/shielded often stay `complete=false` for a long time. Official `wait-for-dust` waits for **available coins**.
2. **API wallet never had spendable DUST.** After thousands of indexer ticks: `coins=0 balance=0`. 1AM showed ~35 000 tDUST on the connected wallet. Dust is **per key**. Likely causes: sponsor mnemonic/seed derives a **different Preprod address** than 1AM, or NIGHT on that key is **not registered** for Dust generation.
3. **Heavy in-process wallet.** `MidnightWalletProvider.build()` can hang on shielded first-state; a Node sponsor must sync indexer state and still needs a **local proof server** (`:6300`) to attach fees.
4. **UI treated “syncing” as temporary.** Deploy auto-fell back to Self-pay or blocked while the real answer was “this sponsor key has zero Dust coins.”

Until CompactLab operates a dedicated Preprod wallet with **registered tNIGHT that generates spendable tDUST**, Sponsored cannot be a reliable community feature.

## v1 decision

- **Default and only public fee path: Self-pay.** Users connect 1AM on Preprod, fund tNIGHT at the faucet, wait for tDUST, Deploy/Call with their own fees. Proving still runs in 1AM.
- **Sponsored code stays in the repo**, gated by `COMPACTLAB_ENABLE_SPONSOR` (API) and `NEXT_PUBLIC_ENABLE_SPONSORED=1` (playground). Re-enable when a funded, registered sponsor wallet is verified (`GET /v1/sponsor/status` reports `healthy` and `dust.availableCoins >= 1` on an address that matches that wallet).
