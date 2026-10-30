"use client";

/**
 * playground-deploy — Real contract deployment for playground IDE projects.
 *
 * IMPORTANT: Do not statically import @midnight-ntwrk/midnight-js-protocol/ledger
 * or @midnight-ntwrk/ledger-v8 (or contract-runtime) at module top-level in client
 * entry points. Ledger WASM/Node paths load fs at import time; in the browser
 * Turbopack aliases `fs` → empty shim → "readFileSync is not a function" and
 * /playground 500s. Prefer dynamic import() at Deploy time (see this file).
 *
 * v1 proving is delegated to the 1AM wallet (getProvingProvider) — no Docker
 * proof server on the CompactLab host.
 */

import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { generateId } from "@/lib/utils";
import type { LogEntry, DeployResult } from "@/lib/compact";
import {
  canDeployProject,
  isDeployableTemplate,
  DEPLOYABLE_TEMPLATES,
  resolveAssetBase,
  type DeployableTemplate,
} from "@/lib/playground-assets";
import { networkConfig } from "@/lib/hello-midnight/types";
import { getActiveNetwork } from "@/lib/user-settings";
import { explainIndexerLimit, indexerSource } from "@/lib/indexer-endpoints";
import { contractExplorerUrl, txExplorerUrl } from "@/lib/explorers";
import { reportFunnelEvent } from "@/lib/funnel-events";
import {
  isWalletSessionExpiredError,
  isWalletSessionExpiredMessage,
  WALLET_SESSION_EXPIRED_MSG,
} from "@/lib/wallet-session";

export {
  canDeployProject,
  isDeployableTemplate,
  DEPLOYABLE_TEMPLATES,
  type DeployableTemplate,
};

/** Milestones surfaced to the deploy progress UI. */
export type DeployStage = "artifacts" | "providers" | "prove";

export async function deployPlaygroundContract(
  connectedAPI: ConnectedAPI,
  template: string,
  addLog: (log: LogEntry) => void,
  options?: {
    artifactBaseUrl?: string | null;
    projectId?: string | null;
    witnessSpecs?: Array<{ name: string; type: string }>;
    witnessValues?: Record<string, string>;
    constructorParams?: Array<{
      name: string;
      type: string;
      typeSchema?: import("@/lib/compact-values").CompactTypeSchema;
    }>;
    constructorValues?: Record<string, string>;
    requireWitnessValuesAtDeploy?: boolean;
    /** Witness names the constructor calls — only these need values at Deploy. */
    requiredWitnessNamesAtDeploy?: string[];
    typeEnv?: import("@/lib/compact-values").CompactTypeEnv;
    feeMode?: "sponsored" | "self";
    onStage?: (stage: DeployStage) => void;
  },
): Promise<DeployResult> {
  const t0 = Date.now();
  const log = (level: LogEntry["level"], message: string) =>
    addLog({ id: generateId(), timestamp: Date.now(), level, message, source: "network" });
  const stage = (s: DeployStage) => options?.onStage?.(s);
  stage("artifacts");

  const network = getActiveNetwork();
  // CompactLab's fee sponsor runs on Preprod only.
  const feeMode = network.sponsorship ? (options?.feeMode ?? "self") : "self";
  log(
    "info",
    feeMode === "sponsored"
      ? "Fee mode: Sponsored (CompactLab pays network fees)."
      : "Fee mode: Self-pay (fees from your tDUST).",
  );
  if (typeof connectedAPI.getProvingProvider !== "function") {
    const msg =
      "Connected wallet cannot prove ZK transactions. CompactLab v1 requires 1AM (https://1am.xyz/).";
    log("error", msg);
    return { success: false, duration: Date.now() - t0, error: msg };
  }

  const witnessSpecs = options?.witnessSpecs ?? [];
  const witnessValues = options?.witnessValues ?? {};
  const constructorParams = options?.constructorParams ?? [];
  const constructorValues = options?.constructorValues ?? {};
  const requireWitnessValuesAtDeploy = options?.requireWitnessValuesAtDeploy === true;
  const requiredWitnessNamesAtDeploy = options?.requiredWitnessNamesAtDeploy ?? [];
  const typeEnv = options?.typeEnv;

  if (constructorParams.length > 0) {
    const { validateCompactParams } = await import("@/lib/compact-values");
    const ctorErr = validateCompactParams(
      constructorParams,
      constructorValues,
      "Constructor parameter",
      typeEnv,
    );
    if (ctorErr) {
      log("error", ctorErr);
      log("warn", "Fill Constructor parameters in Contract UI before Deploy.");
      return { success: false, duration: Date.now() - t0, error: ctorErr };
    }
    log(
      "info",
      `Constructor requires ${constructorParams.length} argument(s): ${constructorParams
        .map((p) => `${p.name}: ${p.type}`)
        .join(", ")}.`,
    );
  }

  if (witnessSpecs.length > 0) {
    if (requireWitnessValuesAtDeploy) {
      const { validateWitnessValues, witnessSpecsForNames } = await import(
        "@/lib/playground-witnesses"
      );
      const requiredSpecs = witnessSpecsForNames(
        witnessSpecs,
        requiredWitnessNamesAtDeploy.length > 0
          ? requiredWitnessNamesAtDeploy
          : witnessSpecs.map((s) => s.name),
      );
      const witnessErr = validateWitnessValues(requiredSpecs, witnessValues);
      if (witnessErr) {
        log("error", witnessErr.replace("before Call", "before Deploy"));
        log(
          "warn",
          "This constructor calls the listed witness(es). Provide them in Deploy setup (other witnesses wait until Call).",
        );
        return {
          success: false,
          duration: Date.now() - t0,
          error: witnessErr.replace("before Call", "before Deploy"),
        };
      }
      log(
        "info",
        `Constructor uses witness(es): ${requiredSpecs.map((s) => s.name).join(", ")}. Other declared witnesses are not required at Deploy.`,
      );
    } else {
      log(
        "info",
        `Contract declares ${witnessSpecs.length} witness(es): ${witnessSpecs.map((s) => s.name).join(", ")}. Values are needed when circuits that call them run (placeholders used at Deploy).`,
      );
    }
  }

  let slug: string;
  let assetBase: string;
  try {
    ({ slug, assetBase } = resolveAssetBase({
      template,
      artifactBaseUrl: options?.artifactBaseUrl,
      projectId: options?.projectId,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("warn", msg);
    log("warn", "Run Compile (ZK) for this project, or open a deployable template (hello-world, counter).");
    return { success: false, duration: Date.now() - t0, error: msg };
  }

  if (options?.artifactBaseUrl) {
    log("info", `Using project ZK artifacts at ${assetBase}`);
  } else {
    log("info", `Using bundled ZK assets at ${assetBase}`);
  }

  stage("providers");
  log("info", `Connecting to Midnight ${network.label}…`);
  log("info", INDEXER_SOURCE_LOG[indexerSource(network)](network.label));

  const { createContractProviders, PlaygroundContractAPI } = await import(
    "@/lib/contract-runtime"
  );

  let providers: Awaited<ReturnType<typeof createContractProviders>>;
  try {
    providers = await createContractProviders(
      connectedAPI as Parameters<typeof createContractProviders>[0],
      networkConfig(network),
      assetBase,
      { storeName: `compactlab:${slug}`, feeMode, projectId: options?.projectId },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isWalletSessionExpiredError(err) || isWalletSessionExpiredMessage(msg)) {
      log("warn", WALLET_SESSION_EXPIRED_MSG);
      log(
        "warn",
        "Deploy paused. Click Reconnect and deploy again; your inputs are kept.",
      );
      return {
        success: false,
        duration: Date.now() - t0,
        error: WALLET_SESSION_EXPIRED_MSG,
      };
    }
    log("error", `Failed to initialise providers: ${msg}`);
    const limit = explainIndexerLimit(err);
    if (limit) log("warn", limit);
    if (msg.toLowerCase().includes("getprovingprovider") || msg.toLowerCase().includes("1am")) {
      log("warn", `Install and connect 1AM from https://1am.xyz/ (${network.label}).`);
    }
    return { success: false, duration: Date.now() - t0, error: `Provider setup failed: ${msg}` };
  }

  stage("prove");
  log("info", "Providers ready. Submitting deploy transaction…");
  if (feeMode === "self") {
    log("info", "ZK proof generation may take 1 to 2 minutes inside 1AM. Approve fee payment when prompted.");
  } else {
    log(
      "info",
      "ZK proof generation may take 1 to 2 minutes inside 1AM. Approve proving when prompted. CompactLab sponsors network fees.",
    );
  }

  const api = new PlaygroundContractAPI(providers, slug, assetBase, {
    witnessSpecs,
    witnessValues,
    constructorParams,
    constructorValues,
    requireWitnessValuesAtDeploy,
    requiredWitnessNamesAtDeploy,
    typeEnv,
  });

  let contractAddress: string;
  let transactionHash: string | undefined;
  let blockNumber: number | undefined;
  try {
    const result = await api.deploy();
    contractAddress = String(result.contractAddress);
    transactionHash = result.transactionHash;
    blockNumber = result.blockNumber;
  } catch (err) {
    const serialize = (v: unknown, depth = 0): string => {
      if (depth > 4) return "[…]";
      if (v instanceof Error) {
        const base = v.message || v.toString();
        return (v as { cause?: unknown }).cause
          ? `${base} → ${serialize((v as { cause?: unknown }).cause, depth + 1)}`
          : base;
      }
      if (typeof v === "string") return v;
      if (v === null || v === undefined) return String(v);
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    };

    const msg = serialize(err);
    if (isWalletSessionExpiredError(err) || isWalletSessionExpiredMessage(msg)) {
      log("warn", WALLET_SESSION_EXPIRED_MSG);
      log(
        "warn",
        "Deploy paused. Click Reconnect and deploy again; your inputs are kept.",
      );
      return {
        success: false,
        duration: Date.now() - t0,
        error: WALLET_SESSION_EXPIRED_MSG,
      };
    }
    log("error", `Deploy transaction failed: ${msg}`);
    const limit = explainIndexerLimit(msg);
    if (limit) log("warn", limit);
    const lower = msg.toLowerCase();
    if (lower.includes("version mismatch") || lower.includes("runtime mismatch")) {
      log(
        "warn",
        "Your ZK artifacts and the playground Compact runtime disagree (often a stale cache after upgrading Compact). Run Compile (ZK) again, hard-refresh the tab, then Deploy.",
      );
    }
    if (lower.includes("compact-runtime") || lower.includes("module specifier")) {
      log(
        "warn",
        "Contract JS uses bare @midnight-ntwrk/compact-runtime imports. CompactLab rewrites them for the browser. Hard-refresh if you still see this.",
      );
    }
    if (lower.includes("witness") || lower.includes("function-valued field") || lower.includes("private witness")) {
      log(
        "warn",
        "Witness *functions* must be wired on the compiled contract. User secret values are supplied at Call (Contract UI → Private witnesses).",
      );
    }
    if (lower.includes("balance") || lower.includes("insufficient") || lower.includes("funds")) {
      log("warn", `Insufficient tDUST on ${network.label}. Faucet: ${network.faucetUrl}`);
    }
    if (lower.includes("1am") || lower.includes("proving") || lower.includes("getprovingprovider")) {
      log("warn", `Ensure 1AM is unlocked on ${network.label} and approved proving for this site.`);
    }
    return { success: false, duration: Date.now() - t0, error: msg };
  }

  const duration = Date.now() - t0;
  log("success", `Contract deployed in ${(duration / 1000).toFixed(1)}s`);
  log("success", `Address: ${contractAddress}`);
  log("info", `View contract: ${contractExplorerUrl(contractAddress, network.id)}`);
  if (transactionHash) {
    log("info", `View transaction: ${txExplorerUrl(transactionHash, network.id)}`);
  }

  reportFunnelEvent("deploy_ok", {
    projectId: options?.projectId ?? undefined,
    template,
    contractAddress,
    feeMode,
  });

  return {
    success: true,
    contractAddress,
    transactionHash,
    blockNumber,
    duration,
    network: network.id,
  };
}

const INDEXER_SOURCE_LOG = {
  public: (label: string) => `Indexer: ${label} public indexer (free, no key).`,
  "own-key": (label: string) => `Indexer: ${label} via your own Blockfrost key (direct from this browser).`,
  compactlab: (label: string) => `Indexer: ${label} via the CompactLab API (shared Blockfrost quota).`,
} as const;
