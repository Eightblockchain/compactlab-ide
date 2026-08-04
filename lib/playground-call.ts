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
  },
): Promise<{ txId: string }> {
  const t0 = Date.now();

  if (typeof connectedAPI.getProvingProvider !== "function") {
    throw new Error(
      "Connected wallet cannot prove ZK transactions. CompactLab v1 requires 1AM (https://1am.xyz/).",
    );
  }

  const witnessSpecs = options?.witnessSpecs ?? [];
  const witnessValues = options?.witnessValues ?? {};
  if (witnessSpecs.length > 0) {
    const { validateWitnessValues } = await import("@/lib/playground-witnesses");
    const witnessErr = validateWitnessValues(witnessSpecs, witnessValues);
    if (witnessErr) {
      log(addLog, "error", witnessErr);
      throw new Error(witnessErr);
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
    `compactlab:${slug}`,
  );

  const api = new PlaygroundContractAPI(providers, slug, assetBase, {
    witnessSpecs,
    witnessValues,
  });
  await api.join(contractAddress as ContractAddress);

  log(addLog, "info", `Calling ${circuitName}(…)…`);
  log(addLog, "info", "ZK proof generation may take 1–2 minutes inside 1AM.");
  log(addLog, "warn", "Approve the transaction fee in 1AM when prompted.");

  try {
    const txResult = await api.callCircuit(circuitName, args);
    const duration = Date.now() - t0;
    log(addLog, "success", `Transaction submitted in ${(duration / 1000).toFixed(1)}s`);
    log(addLog, "success", `Tx ID: ${txResult.txId}`);
    return txResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
  let assetBase: string;
  let slug: string;
  try {
    ({ assetBase, slug } = resolveAssetBase({
      template,
      artifactBaseUrl: options?.artifactBaseUrl,
    }));
  } catch {
    return {};
  }

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
  const mod = await loadBrowserContractModule(assetBase);
  const ledger = mod.ledger(states.contractState.data) as Record<string, unknown>;

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ledger)) {
    if (v === null || v === undefined) continue;
    out[k] =
      typeof v === "object" && v !== null && "toString" in v
        ? String((v as { toString: () => string }).toString())
        : String(v);
  }

  void slug;
  void bundledAssetBase;
  return out;
}
