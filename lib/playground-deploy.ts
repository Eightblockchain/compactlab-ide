"use client";

/**
 * playground-deploy — Real contract deployment for playground IDE projects.
 *
 * Deploy runs entirely in the browser using the Lace wallet.
 * No server-side call is needed — the wallet handles all signing and ZK proving.
 *
 * HOW IT WORKS
 * ─────────────
 * The Compact compiler (via the IDE's compile button) runs with `--skip-zk`,
 * which only checks syntax and circuit structure. For actual on-chain deployment
 * we need precompiled ZK assets (proving keys, ZKIR files). These are bundled
 * in /public/contracts/<template>/ for each supported template.
 *
 * Lace wallet contains an embedded prover that reads the ZKIR files and generates
 * ZK proofs locally. No Docker or external proof server is required by the end user.
 *
 * SUPPORTED TEMPLATES
 * ─────────────────────
 * Only templates that have precompiled ZK assets under /public/contracts/ can be
 * deployed from the playground. Currently: hello-world.
 *
 * To add a new deployable template:
 *   1. Run `compact compile +0.30.0 contracts/<name>.compact ./generated` (without --skip-zk)
 *   2. Copy the output to /public/contracts/<slug>/
 *   3. Add the slug to DEPLOYABLE_TEMPLATES below
 *   4. Add a case to loadDeployHelper()
 */

import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { createHelloWorldProviders } from "@/lib/hello-midnight/providers";
import { HelloMidnightAPI } from "@/lib/hello-midnight/contract-api";
import { PREPROD_CONFIG } from "@/lib/hello-midnight/types";
import { generateId } from "@/lib/utils";
import type { LogEntry, DeployResult } from "@/lib/compact";

// ─── Supported templates ───────────────────────────────────────────────────────

/** Templates that have precompiled ZK assets and can be deployed from the playground. */
export const DEPLOYABLE_TEMPLATES = ["hello-world"] as const;
export type DeployableTemplate = (typeof DEPLOYABLE_TEMPLATES)[number];

export function isDeployableTemplate(template: string): template is DeployableTemplate {
  return (DEPLOYABLE_TEMPLATES as readonly string[]).includes(template);
}

// ─── Deploy ────────────────────────────────────────────────────────────────────

/**
 * Deploys a playground project contract to Midnight Preprod.
 *
 * @param connectedAPI  - Lace wallet connected API (from useLaceWallet)
 * @param template      - Project template slug (e.g. "hello-world")
 * @param addLog        - Log sink for IDE bottom panel
 * @returns DeployResult with real contractAddress on success
 */
export async function deployPlaygroundContract(
  connectedAPI: ConnectedAPI,
  template: string,
  addLog: (log: LogEntry) => void,
): Promise<DeployResult> {
  const t0 = Date.now();
  const log = (level: LogEntry["level"], message: string) =>
    addLog({ id: generateId(), timestamp: Date.now(), level, message, source: "network" });

  // ── Gate: only templates with precompiled ZK assets are supported ────────────
  if (!isDeployableTemplate(template)) {
    log("warn", `Template "${template}" does not have precompiled ZK assets in /public/contracts/.`);
    log("warn", "To deploy this contract: compile without --skip-zk, copy output to /public/contracts/<slug>/, then redeploy.");
    return {
      success: false,
      duration: Date.now() - t0,
      error: `No precompiled ZK assets for template "${template}". See network log for details.`,
    };
  }

  // ── Build providers ───────────────────────────────────────────────────────────
  log("info", "Connecting to Midnight Preprod…");
  log("info", `Indexer: ${PREPROD_CONFIG.indexerUri}`);

  let providers: Awaited<ReturnType<typeof createHelloWorldProviders>>;
  try {
    providers = await createHelloWorldProviders(
      connectedAPI as Parameters<typeof createHelloWorldProviders>[0],
      PREPROD_CONFIG,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `Failed to initialise providers: ${msg}`);
    if (msg.toLowerCase().includes("proving") || msg.toLowerCase().includes("prover")) {
      log("warn", "Your wallet may not support getProvingProvider. Make sure you are using Midnight Lace and have accepted the connection.");
    }
    return { success: false, duration: Date.now() - t0, error: `Provider setup failed: ${msg}` };
  }

  // ── Deploy ────────────────────────────────────────────────────────────────────
  log("info", "Providers ready. Submitting deploy transaction…");
  log("info", "⏳ First deploy may take 1–2 minutes — the wallet is generating ZK proofs locally.");

  const api = new HelloMidnightAPI(providers);

  let contractAddress: Awaited<ReturnType<typeof api.deploy>>["contractAddress"];
  try {
    ({ contractAddress } = await api.deploy());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `Deploy transaction failed: ${msg}`);
    if (msg.includes("verifier key") || msg.includes("prover key") || msg.includes("zkir")) {
      log("warn", "ZK asset fetch failed. Expected files at /contracts/hello-world/keys/ and /contracts/hello-world/zkir/.");
      log("warn", "Make sure the Next.js dev server is running on localhost:3000 and the /public/contracts/ directory is present.");
    }
    if (msg.includes("user") || msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("reject")) {
      log("warn", "It looks like the wallet request was rejected. Open Lace and approve the transaction.");
    }
    return { success: false, duration: Date.now() - t0, error: msg };
  }

  const duration = Date.now() - t0;
  const addr = String(contractAddress);

  log("success", `Contract deployed in ${(duration / 1000).toFixed(1)}s`);
  log("success", `Address: ${addr}`);
  log("info", "Share this address with other users so they can join and interact with the contract.");

  return {
    success: true,
    contractAddress: addr,
    duration,
  };
}
