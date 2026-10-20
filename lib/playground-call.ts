"use client";

/**
 * playground-call — Real circuit invocation for playground IDE projects.
 *
 * Same constraint as playground-deploy: never statically import contract-runtime /
 * ledger-v8 into the page graph — use dynamic import() at call time.
 */

import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { generateId } from "@/lib/utils";
import type { LogEntry } from "@/lib/compact";
import { resolveAssetBase, bundledAssetBase } from "@/lib/playground-assets";
import { PREPROD_CONFIG } from "@/lib/hello-midnight/types";

function log(addLog: (l: LogEntry) => void, level: LogEntry["level"], message: string) {
  addLog({ id: generateId(), timestamp: Date.now(), level, message, source: "network" });
}

export async function callPlaygroundCircuit(
  connectedAPI: ConnectedAPI,
  template: string,
  contractAddress: string,
  circuitName: string,
  args: Record<string, string>,
  addLog: (l: LogEntry) => void,
  options?: {
    artifactBaseUrl?: string | null;
    projectId?: string | null;
    witnessSpecs?: Array<{ name: string; type: string }>;
    witnessValues?: Record<string, string>;
    /** Witness names this circuit body calls — only these need values for Call. */
    requiredWitnessNames?: string[];
    circuitParams?: Array<{
      name: string;
      type: string;
      typeSchema?: import("@/lib/compact-values").CompactTypeSchema;
    }>;
    typeEnv?: import("@/lib/compact-values").CompactTypeEnv;
    feeMode?: "sponsored" | "self";
  },
): Promise<{
  txId: string;
  txHash?: string;
  status?: string;
  blockHeight?: number;
  returnValue: string;
}> {
  const t0 = Date.now();

  if (typeof connectedAPI.getProvingProvider !== "function") {
    throw new Error(
      "Connected wallet cannot prove ZK transactions. CompactLab v1 requires 1AM (https://1am.xyz/).",
    );
  }

  const feeMode = options?.feeMode ?? "self";
  log(
    addLog,
    "info",
    feeMode === "sponsored"
      ? "Fee mode: Sponsored (CompactLab pays network fees)."
      : "Fee mode: Self-pay (fees from your tDUST).",
  );

  const witnessSpecs = options?.witnessSpecs ?? [];
  const witnessValues = options?.witnessValues ?? {};
  const circuitParams = options?.circuitParams ?? [];
  const typeEnv = options?.typeEnv;

  if (circuitParams.length > 0) {
    const { validateCompactParams } = await import("@/lib/compact-values");
    const argErr = validateCompactParams(circuitParams, args, "Circuit argument", typeEnv);
    if (argErr) {
      log(addLog, "error", argErr);
      throw new Error(argErr);
    }
  }

  if (witnessSpecs.length > 0) {
    const { validateWitnessValues, witnessSpecsForNames } = await import(
      "@/lib/playground-witnesses"
    );
    const requiredNames = options?.requiredWitnessNames;
    const requiredSpecs =
      requiredNames !== undefined
        ? witnessSpecsForNames(witnessSpecs, requiredNames)
        : witnessSpecs;
    if (requiredSpecs.length > 0) {
      const witnessErr = validateWitnessValues(requiredSpecs, witnessValues);
      if (witnessErr) {
        log(addLog, "error", witnessErr);
        throw new Error(witnessErr);
      }
      log(
        addLog,
        "info",
        `${circuitName} uses witness(es): ${requiredSpecs.map((s) => s.name).join(", ")}.`,
      );
    } else {
      log(
        addLog,
        "info",
        `${circuitName} does not call private witnesses — no witness values required for this Call.`,
      );
    }
  }

  const { slug, assetBase } = resolveAssetBase({
    template,
    artifactBaseUrl: options?.artifactBaseUrl,
    projectId: options?.projectId,
  });

  log(addLog, "info", `Joining contract ${contractAddress.slice(0, 16)}… (${slug} @ ${assetBase})`);
  log(addLog, "info", "ZK proving via 1AM wallet (no Docker proof server).");

  const { createContractProviders, PlaygroundContractAPI } = await import(
    "@/lib/contract-runtime"
  );

  const providers = await createContractProviders(
    connectedAPI as Parameters<typeof createContractProviders>[0],
    PREPROD_CONFIG,
    assetBase,
    { storeName: `compactlab:${slug}`, feeMode },
  );

  const api = new PlaygroundContractAPI(providers, slug, assetBase, {
    witnessSpecs,
    witnessValues,
    requiredWitnessNamesAtCall: options?.requiredWitnessNames,
    typeEnv,
  });
  await api.join(contractAddress as ContractAddress);

  log(addLog, "info", `Calling ${circuitName}(…)…`);
  log(addLog, "info", "ZK proof generation may take 1 to 2 minutes inside 1AM.");
  if (feeMode === "self") {
    log(addLog, "warn", "Approve the transaction fee in 1AM when prompted.");
  } else {
    log(addLog, "info", "Approve proving in 1AM when prompted. Network fees are sponsored by CompactLab.");
  }

  try {
    const txResult = await api.callCircuit(circuitName, args, circuitParams);
    const duration = Date.now() - t0;
    log(addLog, "success", `${circuitName} confirmed in ${(duration / 1000).toFixed(1)}s`);
    if (txResult.status) log(addLog, "info", `Tx status: ${txResult.status}`);
    log(addLog, "success", `Tx ID: ${txResult.txId}`);
    if (txResult.returnValue && txResult.returnValue !== "[]") {
      log(addLog, "info", `Circuit return: ${txResult.returnValue}`);
    }
    return txResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const { isWalletSessionExpiredError, isWalletSessionExpiredMessage, WALLET_SESSION_EXPIRED_MSG } =
      await import("@/lib/wallet-session");
    if (isWalletSessionExpiredError(err) || isWalletSessionExpiredMessage(msg)) {
      log(addLog, "warn", WALLET_SESSION_EXPIRED_MSG);
      log(
        addLog,
        "warn",
        "Call paused for reconnect. Click Reconnect 1AM in the toolbar, then try the circuit again.",
      );
      throw new Error(WALLET_SESSION_EXPIRED_MSG);
    }
    const lower = msg.toLowerCase();
    if (lower.includes("not the current owner")) {
      log(
        addLog,
        "warn",
        "Ownership failed: use the same private witness value(s) in Contract UI that you used when posting (do not Generate a new key).",
      );
    }
    throw new Error(`${circuitName} failed: ${msg}`);
  }
}

export async function readPlaygroundState(
  template: string,
  contractAddress: string,
  options?: { artifactBaseUrl?: string | null },
): Promise<Record<string, string>> {
  const { assetBase, slug } = resolveAssetBase({
    template,
    artifactBaseUrl: options?.artifactBaseUrl,
  });

  // Dynamic import of SDK pieces that may pull Node-only deps
  const { setNetworkId } = await import("@midnight-ntwrk/midnight-js-network-id");
  const { indexerPublicDataProvider } = await import(
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
  );
  const { getPublicStates } = await import("@midnight-ntwrk/midnight-js-contracts");

  setNetworkId(PREPROD_CONFIG.networkId);

  const publicDataProvider = indexerPublicDataProvider(
    PREPROD_CONFIG.indexerUri,
    PREPROD_CONFIG.indexerWsUri,
  );

  const states = await getPublicStates(
    publicDataProvider,
    contractAddress as ContractAddress,
  );

  const { loadBrowserContractModule } = await import("@/lib/browser-contract-module");
  const { formatLedgerSnapshot } = await import("@/lib/compact-runtime-format");
  const mod = await loadBrowserContractModule(assetBase);
  const ledger = mod.ledger(states.contractState.data) as Record<string, unknown>;

  void slug;
  void bundledAssetBase;
  return formatLedgerSnapshot(ledger);
}
