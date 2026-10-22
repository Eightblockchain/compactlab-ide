# Contributing to CompactLab

Thanks for helping. Bug reports, template contributions and fixes are all welcome.

## Before you start

- **Bugs**: open an issue with steps to reproduce, your browser, the network (Preprod or Preview) and, if it's a compile problem, the contract source.
- **Bigger changes**: open an issue first so we can agree on the approach before you write the code.
- **Security problems**: don't open a public issue. Email the maintainers through the contact on [compactlab.dev](https://compactlab.dev).

## Set up

Follow "Run it locally" in the [README](README.md). The playground needs the API running next to it.

## Making a change

1. Branch from `main`: `feat/...`, `fix/...` or `chore/...`.
2. Keep the change focused; one topic per pull request.
3. Run the checks before pushing:

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

   If you touched templates or compile code, also run `pnpm templates:check`.
4. Open a pull request saying what changed, why, and how you tested it. For UI changes, add a screenshot.

## Project rules

These are not negotiable. Reviews will block on them.

- **Toolchain pins.** The compiler (`lib/version.ts`), Midnight.js and ledger versions follow the [Midnight support matrix](https://docs.midnight.network/relnotes/support-matrix). Don't change them in an unrelated PR.
- **No secrets.** Never commit a seed, mnemonic, API key or private input, and never log one. Server secrets live only in `api/.env`.
- **The user signs.** Deploy and Call always need a click from the user and a signature from their wallet. Don't add code paths that deploy or call on their own.
- **Sponsored fees are only for CompactLab contracts.** Don't add a path that sponsors arbitrary transactions.
- **Private inputs stay private.** Witness values stay in the browser unless the user turns on sync. Don't send them in telemetry, logs or errors.
- **Next.js.** This repo uses a newer Next.js than most tutorials describe. Check `node_modules/next/dist/docs/` before relying on an API.

## Templates

Templates are defined in `COMPACT_TEMPLATES` in `lib/constants.ts`. A new template needs:

- a contract that compiles with the pinned compiler (`pnpm templates:check`);
- a short description of what it shows about Midnight's privacy model;
- no witness defaults that look like real secrets.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
