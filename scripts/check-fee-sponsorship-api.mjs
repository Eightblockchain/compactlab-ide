/**
 * Phase 0 / smoke: confirm 1AM connector surface used for sponsorship user-half.
 * Run from compactlab: node --input-type=module scripts/check-fee-sponsorship-api.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDts = readFileSync(
  join(
    root,
    "node_modules/@midnight-ntwrk/dapp-connector-api/dist/api.d.ts",
  ),
  "utf8",
);

const hasPayFees = /balanceUnsealedTransaction[\s\S]*?payFees\?: boolean/.test(
  apiDts,
);
const hasBalanceSealed = /balanceSealedTransaction[\s\S]*?payFees\?: boolean/.test(
  apiDts,
);

if (!hasPayFees || !hasBalanceSealed) {
  console.error("FAIL: dapp-connector-api missing payFees options");
  process.exit(1);
}

console.log("OK: 1AM connector exposes balanceUnsealedTransaction({ payFees })");
console.log("OK: 1AM connector exposes balanceSealedTransaction({ payFees })");
console.log(
  "User half: payFees:false → API POST /v1/sponsor → sponsor balanceSealed payFees:true + submit",
);
