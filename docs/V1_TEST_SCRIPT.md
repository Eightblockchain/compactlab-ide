# CompactLab v1 test script (separate repos)

1. Start `api` on `:4000`, `landing-page` on `:3000`, `compactlab` on `:3001`, `admin` on `:3002`. Restart the API so plan seed upserts Community quotas.
2. Landing shows a free community section (no Pro / Stripe CTA). CTAs go to playground `/signup` / `/login`.
3. Unauthenticated `/playground` redirects to `/login`.
4. Signup → Community chip (not Free/Pro). Hello/Counter Instant Deploy with 1AM.
5. Connect 1AM on Preprod. Fund tNIGHT at the faucet if tDUST is 0. Deploy opens a progress modal (connect → fees → artifacts → providers → prove). Empty tDUST should fail in the modal, not silently continue.
6. After success: copy address, open 1AM explorer, Open Contract UI, Call a circuit.
7. Sponsored / Upgrade-to-Pro are hidden. Do not test Stripe unless `COMPACTLAB_ENABLE_BILLING=true` and `NEXT_PUBLIC_ENABLE_BILLING=1`.
8. Admin login toggles compile / maintenance / announcement.
