import { generateId } from "./utils";
import {
  extractCircuits as scanCircuits,
  extractLedgerVars as scanLedgerVars,
  extractWitnesses as scanWitnesses,
} from "./compact-symbols";
import { extractConstructorParams } from "./compact-constructor";

export type LogLevel = "info" | "success" | "error" | "warn" | "debug";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  source?: string;
}

export interface CompileResult {
  success: boolean;
  duration: number;
  constraintCount?: number;
  circuitMetadata?: CircuitMeta[];
  /** Compact constructor parameters (empty inputs = no-arg constructor). */
  constructorMetadata?: {
    inputs: {
      name: string;
      type: string;
      typeSchema?: import("./compact-values").CompactTypeSchema;
    }[];
  };
  errors?: CompileError[];
  warnings?: string[];
  mock?: boolean;
  compilerVersion?: string;
  languageVersion?: string;
  skipZk?: boolean;
  stdoutHint?: string;
  artifacts?: {
    skipZk: boolean;
    contract: string[];
    keys: string[];
    zkir: string[];
    compiler: string[];
  };
  generatedFiles?: Array<{
    path?: string;
    name: string;
    language: "json" | "javascript" | "typescript" | "text";
    content: string;
  }>;
  /** Present when a full ZK compile wrote assets under /contracts/... */
  artifactBaseUrl?: string;
  projectId?: string;
  error?: string;
  installHint?: string;
}

export interface CircuitMeta {
  name: string;
  inputs: {
    name: string;
    type: string;
    /** Nested schema from contract-info.json when available. */
    typeSchema?: import("./compact-values").CompactTypeSchema;
  }[];
  output: string;
  constraints: number;
  isExported: boolean;
}

export interface CompileError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

export interface DeployResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  duration: number;
  error?: string;
  /** Network the contract was deployed on (older results: Preprod). */
  network?: import("@/lib/network").PlaygroundNetwork;
}

/** Client helper: POST /v1/compile on the shared API (queued + polled). */
export async function compileCompact(
  code: string,
  options?: { projectId?: string; zk?: boolean },
): Promise<CompileResult & { pragmaNormalized?: boolean; normalizedCode?: string }> {
  const { normalizeCompactPragma } = await import("@/lib/version");
  const { code: normalizedCode, changed } = normalizeCompactPragma(code);
  const { apiFetch } = await import("@/lib/api");

  const fail = (
    message: string,
    extra?: Partial<CompileResult>,
  ): CompileResult & { pragmaNormalized?: boolean; normalizedCode?: string } => ({
    success: false,
    duration: extra?.duration ?? 0,
    errors: extra?.errors ?? [
      {
        line: 1,
        column: 1,
        message,
        severity: "error",
      },
    ],
    warnings: extra?.warnings,
    installHint: extra?.installHint,
    mock: false,
    pragmaNormalized: changed,
    normalizedCode: changed ? normalizedCode : undefined,
    error: message,
  });

  const res = await apiFetch("/v1/compile", {
    method: "POST",
    json: {
      code: normalizedCode,
      projectId: options?.projectId,
      zk: options?.zk ?? false,
      async: true,
    },
  });

  const text = await res.text();
  let body: CompileResult & {
    error?: string;
    installHint?: string;
    jobId?: string;
    status?: string;
    result?: CompileResult;
  };
  try {
    body = text ? (JSON.parse(text) as typeof body) : ({} as typeof body);
  } catch {
    const snippet = text.trim().slice(0, 180) || res.statusText || "empty response";
    return fail(`Compile service returned non-JSON (${res.status}): ${snippet}`);
  }

  if (!res.ok && res.status !== 202) {
    return fail(
      body.error ?? body.installHint ?? `Compile service returned ${res.status}`,
      {
        duration: body.duration ?? 0,
        errors: body.errors,
        warnings: body.warnings,
        installHint: body.installHint,
      },
    );
  }

  const jobId = body.jobId;
  if (!jobId) {
    if (typeof body.success === "boolean") {
      return {
        ...body,
        pragmaNormalized: changed,
        normalizedCode: changed ? normalizedCode : undefined,
      };
    }
    return fail("Compile service did not return a job id");
  }

  const started = Date.now();
  const timeoutMs = options?.zk ? 11 * 60_000 : 45_000;

  while (Date.now() - started < timeoutMs) {
    const poll = await apiFetch(`/v1/compile/jobs/${jobId}`);
    const pollText = await poll.text();
    let job: typeof body;
    try {
      job = pollText ? (JSON.parse(pollText) as typeof body) : ({} as typeof body);
    } catch {
      return fail(`Compile job poll returned non-JSON (${poll.status})`);
    }
    if (!poll.ok) {
      return fail(job.error ?? `Compile job poll failed (${poll.status})`);
    }

    if (job.status === "queued" || job.status === "running") {
      await new Promise((r) => setTimeout(r, job.status === "queued" ? 600 : 900));
      continue;
    }

    const outcome = job.result;
    if (!outcome) {
      return fail(job.error ?? "Compile finished without a result");
    }
    return {
      ...outcome,
      pragmaNormalized: changed,
      normalizedCode: changed ? normalizedCode : undefined,
    };
  }

  return fail(
    options?.zk
      ? "Compile timed out waiting in the server queue (ZK can take several minutes)."
      : "Typecheck timed out waiting in the server queue.",
  );
}

// Extract circuits from Compact code (source scan — not a real compiler)
export function extractCircuits(code: string): CircuitMeta[] {
  return scanCircuits(code).map((c) => ({
    name: c.name,
    inputs: c.params ?? [],
    output: c.type ?? "[]",
    constraints: 0,
    isExported: c.isExported ?? false,
  }));
}

// Extract ledger variables from code (source scan)
export function extractLedgerVars(code: string): {
  name: string;
  type: string;
  isPublic: boolean;
  isExported: boolean;
}[] {
  return scanLedgerVars(code).map((v) => ({
    name: v.name,
    type: v.type ?? "Unknown",
    isPublic: true,
    isExported: v.isExported === true,
  }));
}

// Extract witnesses from code (source scan)
export function extractWitnesses(code: string): { name: string; type: string }[] {
  return scanWitnesses(code).map((w) => ({
    name: w.name,
    type: w.type ?? "Unknown",
  }));
}

/** Extract constructor parameters from Compact source (empty if none / no-arg). */
export function extractConstructor(code: string): { name: string; type: string }[] {
  return extractConstructorParams(code);
}

/** Build a standard log entry. */
export function makeLog(
  level: LogLevel,
  message: string,
  source?: string,
): LogEntry {
  return { id: generateId(), timestamp: Date.now(), level, message, source };
}
