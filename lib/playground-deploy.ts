"use client";

/**
 * playground-deploy — Real contract deployment for playground IDE projects.
 *
 * IMPORTANT: Do not statically import @midnight-ntwrk/ledger-v8 (or contract-runtime).
 * ledger-v8 calls fs.readFileSync at module load; in the browser Turbopack aliases
 * `fs` to an empty shim → "readFileSync is not a function" and /playground 500s.
 * Heavy Midnight SDK code is loaded via dynamic import() only when Deploy runs.
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
import { PREPROD_CONFIG } from "@/lib/hello-midnight/types";

export {
  canDeployProject,
  isDeployableTemplate,
  DEPLOYABLE_TEMPLATES,
  type DeployableTemplate,
};

// ─── Proof server helpers ──────────────────────────────────────────────────────

async function isProofServerHealthy(): Promise<boolean> {
  try {
    const res = await fetch("/api/proof/health", { signal: AbortSignal.timeout(4_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureProofServer(
  log: (level: LogEntry["level"], message: string) => void,
): Promise<boolean> {
  if (await isProofServerHealthy()) {
    log("info", "✓ Proof server is running.");
    return true;
  }

  log("info", "Starting Docker proof server (midnightntwrk/proof-server)…");
  log("info", "This may take a moment if the image needs to be pulled.");

  let startOk = false;
  try {
    const res = await fetch("/api/proof/start", { method: "POST" });
    const body = (await res.json()) as {
      started: boolean;
      alreadyRunning?: boolean;
      error?: string;
    };
    if (!body.started) {
      log("error", `Could not start proof server: ${body.error ?? "unknown error"}`);
      if (body.error?.toLowerCase().includes("docker")) {
        log("error", "Install Docker Desktop from https://docker.com and make sure it is running.");
      }
      return false;
    }
    startOk = true;
    if (body.alreadyRunning) {
      log("info", "Proof server container already exists — waiting for it to be ready…");
    } else {
      log("info", "✓ Container started. Waiting for proof server to be ready…");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `Could not reach /api/proof/start: ${msg}`);
    log("error", "Start manually: docker run -p 6300:6300 midnightntwrk/proof-server");
    return false;
  }

  if (!startOk) return false;

  const deadline = Date.now() + 60_000;
  let attempts = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_000));
    attempts++;
    if (await isProofServerHealthy()) {
      log("info", `✓ Proof server is ready (${attempts * 2}s).`);
      return true;
    }
    if (attempts % 5 === 0) {
      log("info", `Still waiting for proof server… (${attempts * 2}s elapsed)`);
    }
  }

  log("error", "Proof server did not become ready within 60 seconds.");
  return false;
}

export async function checkProofServerHealthy(): Promise<boolean> {
  return isProofServerHealthy();
}

// ─── Deploy ────────────────────────────────────────────────────────────────────

export async function deployPlaygroundContract(
  connectedAPI: ConnectedAPI,
  template: string,
  addLog: (log: LogEntry) => void,
  options?: {
    artifactBaseUrl?: string | null;
    projectId?: string | null;
    witnessSpecs?: Array<{ name: string; type: string }>;
    witnessValues?: Record<string, string>;
  },
): Promise<DeployResult> {
  const t0 = Date.now();
  const log = (level: LogEntry["level"], message: string) =>
    addLog({ id: generateId(), timestamp: Date.now(), level, message, source: "network" });

  const witnessSpecs = options?.witnessSpecs ?? [];
  const witnessValues = options?.witnessValues ?? {};
  if (witnessSpecs.length > 0) {
    log(
      "info",
      `Contract declares ${witnessSpecs.length} witness(es): ${witnessSpecs.map((s) => s.name).join(", ")}. Values are needed at Call, not Deploy.`,
    );
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
    log("warn", "IDE --skip-zk compile does not change these assets. Use Compile (ZK) to deploy your edits.");
  }

  const proofReady = await ensureProofServer(log);
  if (!proofReady) {
    return {
      success: false,
      duration: Date.now() - t0,
      error: "Proof server could not be started. See network log for details.",
    };
  }

  log("info", "Connecting to Midnight Preprod…");
  log("info", `Indexer: ${PREPROD_CONFIG.indexerUri}`);

  // Dynamic import — keeps ledger-v8 out of the initial playground bundle
  const { createContractProviders, PlaygroundContractAPI } = await import(
    "@/lib/contract-runtime"
  );

  let providers: Awaited<ReturnType<typeof createContractProviders>>;
  try {
    providers = await createContractProviders(
      connectedAPI as Parameters<typeof createContractProviders>[0],
      PREPROD_CONFIG,
      assetBase,
      `compactlab:${slug}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `Failed to initialise providers: ${msg}`);
    return { success: false, duration: Date.now() - t0, error: `Provider setup failed: ${msg}` };
  }

  log("info", "Providers ready. Submitting deploy transaction…");
  log("info", "⏳ ZK proofs via Docker proof server (localhost:6300). This may take 1–2 minutes.");

  const api = new PlaygroundContractAPI(providers, slug, assetBase, {
    witnessSpecs,
    witnessValues,
  });

  let contractAddress: string;
  try {
    const result = await api.deploy();
    contractAddress = String(result.contractAddress);
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
    log("error", `Deploy transaction failed: ${msg}`);
    const lower = msg.toLowerCase();
    if (lower.includes("proof server") || lower.includes("503") || lower.includes("cannot reach")) {
      log("warn", "Cannot reach the local Docker proof server. Start it with:");
      log("warn", "  docker run -p 6300:6300 midnightntwrk/proof-server");
    }
    if (lower.includes("compact-runtime") || lower.includes("module specifier")) {
      log("warn", "Contract JS uses bare @midnight-ntwrk/compact-runtime imports; CompactLab rewrites them for the browser. Hard-refresh if you still see this.");
    }
    if (lower.includes("witness") || lower.includes("function-valued field") || lower.includes("private witness")) {
      log(
        "warn",
        "Witness *functions* must be wired on the compiled contract. User secret values are supplied at Call (Contract UI → Private witnesses).",
      );
    }
    if (lower.includes("balance") || lower.includes("insufficient") || lower.includes("funds")) {
      log("warn", "Insufficient tDUST on Preprod. Faucet: https://faucet.preprod.midnight.network/");
    }
    return { success: false, duration: Date.now() - t0, error: msg };
  }

  const duration = Date.now() - t0;
  log("success", `Contract deployed in ${(duration / 1000).toFixed(1)}s`);
  log("success", `Address: ${contractAddress}`);

  return {
    success: true,
    contractAddress,
    duration,
  };
}
