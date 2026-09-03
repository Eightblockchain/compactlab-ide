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
}

/** Client helper: POST /v1/compile on the shared API. */
export async function compileCompact(
  code: string,
  options?: { projectId?: string; zk?: boolean },
): Promise<CompileResult & { pragmaNormalized?: boolean; normalizedCode?: string }> {
  const { normalizeCompactPragma } = await import("@/lib/version");
  const { code: normalizedCode, changed } = normalizeCompactPragma(code);
  const { apiFetch, API_BASE } = await import("@/lib/api");

  const res = await apiFetch("/v1/compile", {
    method: "POST",
    json: {
      code: normalizedCode,
      projectId: options?.projectId,
      zk: options?.zk ?? false,
    },
  });
  void API_BASE;

  const text = await res.text();
  let body: CompileResult & {
    error?: string;
    installHint?: string;
    details?: unknown;
  };
  try {
    body = text ? (JSON.parse(text) as typeof body) : ({} as typeof body);
  } catch {
    const snippet = text.trim().slice(0, 180) || res.statusText || "empty response";
    return {
      success: false,
      duration: 0,
      errors: [
        {
          line: 1,
          column: 1,
          message: `Compile service returned non-JSON (${res.status}): ${snippet}`,
          severity: "error",
        },
      ],
      mock: false,
      pragmaNormalized: changed,
      normalizedCode: changed ? normalizedCode : undefined,
      error: snippet,
    };
  }

  if (!res.ok) {
    return {
      success: false,
      duration: body.duration ?? 0,
      errors: body.errors ?? [
        {
          line: 1,
          column: 1,
          message:
            body.error ??
            body.installHint ??
            `Compile service returned ${res.status}`,
          severity: "error",
        },
      ],
      warnings: body.warnings,
      installHint: body.installHint,
      error: body.error,
      mock: false,
      pragmaNormalized: changed,
      normalizedCode: changed ? normalizedCode : undefined,
    };
  }

  return {
    ...body,
    pragmaNormalized: changed,
    normalizedCode: changed ? normalizedCode : undefined,
  };
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
export function extractLedgerVars(code: string): { name: string; type: string; isPublic: boolean }[] {
  return scanLedgerVars(code).map((v) => ({
    name: v.name,
    type: v.type ?? "Unknown",
    isPublic: true,
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
