/**
 * Matrix alignment smoke checks (no wallet / no network Deploy).
 * Run: pnpm exec tsx scripts/smoke-matrix.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const expected = {
  "@midnight-ntwrk/compact-runtime": "0.16.0",
  "@midnight-ntwrk/compact-js": "2.5.1",
  "@midnight-ntwrk/midnight-js-contracts": "4.1.1",
  "@midnight-ntwrk/midnight-js-protocol": "4.1.1",
  "@midnight-ntwrk/midnight-js-utils": "4.1.1",
  "@midnight-ntwrk/dapp-connector-api": "4.0.1",
  "@midnight-ntwrk/ledger-v8": "8.1.0",
  "@midnight-ntwrk/wallet-sdk-address-format": "3.1.2",
} as const;

function pkgVersion(name: string): string {
  const parts = name.split("/");
  const pkgPath = join(root, "node_modules", ...parts, "package.json");
  const j = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  if (!j.version) throw new Error(`No version in ${pkgPath}`);
  return j.version;
}

async function main() {
  console.log("=== package versions ===");
  for (const [name, want] of Object.entries(expected)) {
    const got = pkgVersion(name);
    if (got !== want) {
      throw new Error(`${name}: expected ${want}, got ${got}`);
    }
    console.log(`ok ${name}@${got}`);
  }

  console.log("=== protocol / runtime imports ===");
  const ledger = await import("@midnight-ntwrk/midnight-js-protocol/ledger");
  if (typeof ledger.CostModel?.initialCostModel !== "function") {
    throw new Error("CostModel.initialCostModel missing");
  }
  const cost = ledger.CostModel.initialCostModel();
  console.log("ok CostModel.initialCostModel()", typeof cost);

  const { CompiledContract } = await import("@midnight-ntwrk/compact-js");
  if (!CompiledContract) throw new Error("CompiledContract missing");
  console.log("ok CompiledContract");

  const rt = await import("@midnight-ntwrk/compact-runtime");
  rt.checkRuntimeVersion("0.16.0");
  console.log("ok checkRuntimeVersion(0.16.0)");

  const contracts = await import("@midnight-ntwrk/midnight-js-contracts");
  for (const k of ["deployContract", "findDeployedContract", "getPublicStates"] as const) {
    if (typeof (contracts as Record<string, unknown>)[k] !== "function") {
      throw new Error(`${k} missing from midnight-js-contracts`);
    }
  }
  console.log("ok midnight-js-contracts deploy/find/getPublicStates");

  console.log("=== Instant Deploy artifacts ===");
  for (const name of ["hello-world", "counter"] as const) {
    const info = JSON.parse(
      readFileSync(join(root, "public/contracts", name, "compiler/contract-info.json"), "utf8"),
    ) as Record<string, string>;
    if (info["compiler-version"] !== "0.31.1") {
      throw new Error(`${name}: compiler-version ${info["compiler-version"]}`);
    }
    if (info["language-version"] !== "0.23.0") {
      throw new Error(`${name}: language-version ${info["language-version"]}`);
    }
    if (info["runtime-version"] !== "0.16.0") {
      throw new Error(`${name}: runtime-version ${info["runtime-version"]}`);
    }
    const idx = readFileSync(join(root, "public/contracts", name, "contract/index.js"), "utf8");
    if (!idx.includes("checkRuntimeVersion('0.16.0')") && !idx.includes('checkRuntimeVersion("0.16.0")')) {
      throw new Error(`${name}: contract/index.js missing runtime 0.16.0 guard`);
    }
    console.log(`ok ${name} artifacts`, {
      compiler: info["compiler-version"],
      language: info["language-version"],
      runtime: info["runtime-version"],
    });
  }

  console.log("=== ALL SMOKE CHECKS PASSED ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
