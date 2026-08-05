# CompactLab v1 test script (separate repos)

1. Start `api` on `:4000`, `landing-page` on `:3000`, `compactlab` on `:3001`, `admin` on `:3002`.
2. Landing shows Free/Pro from API; CTAs go to playground `/signup` / `/login`.
3. Unauthenticated `/playground` redirects to `/login`.
4. Signup → Free chip → Instant Deploy Hello/Counter with 1AM.
5. Admin login toggles compile / maintenance / announcement.
6. Stripe Upgrade only when `STRIPE_*` configured on API.
