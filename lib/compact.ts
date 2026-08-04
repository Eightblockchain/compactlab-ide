import { generateId } from "./utils";

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
  inputs: { name: string; type: string }[];
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

export interface SimulateResult {
  success: boolean;
  output: unknown;
  logs: LogEntry[];
  gasUsed?: number;
  duration: number;
  stateChanges?: { key: string; before: string; after: string }[];
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

/** Client helper: POST /api/compile and return typed result. */
export async function compileCompact(
  code: string,
  options?: { projectId?: string; zk?: boolean },
): Promise<CompileResult & { pragmaNormalized?: boolean; normalizedCode?: string }> {
  const { normalizeCompactPragma } = await import("@/lib/version");
  const { code: normalizedCode, changed } = normalizeCompactPragma(code);

  const res = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: normalizedCode,
      projectId: options?.projectId,
      zk: options?.zk ?? false,
    }),
  });

  const body = (await res.json()) as CompileResult & {
    error?: string;
    installHint?: string;
    details?: unknown;
  };

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
  const circuits: CircuitMeta[] = [];
  const circuitRegex = /export\s+circuit\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^\{]+)/g;
  let match;

  while ((match = circuitRegex.exec(code)) !== null) {
    const name = match[1];
    const paramsStr = match[2].trim();
    const outputStr = match[3].trim();

    const inputs = paramsStr
      ? paramsStr.split(",").map((p) => {
          const parts = p.trim().split(":");
          return {
            name: parts[0]?.trim() || "param",
            type: parts[1]?.trim() || "Uint<32>",
          };
        })
      : [];

    circuits.push({
      name,
      inputs,
      output: outputStr,
      constraints: 0,
      isExported: true,
    });
  }

  return circuits;
}

// Extract ledger variables from code (source scan)
export function extractLedgerVars(code: string): { name: string; type: string; isPublic: boolean }[] {
  const vars: { name: string; type: string; isPublic: boolean }[] = [];
  const ledgerRegex = /(?:export\s+)?(?:sealed\s+)?ledger\s+(\w+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = ledgerRegex.exec(code)) !== null) {
    vars.push({
      name: match[1],
      type: match[2].trim(),
      isPublic: true,
    });
  }

  return vars;
}

// Extract witness declarations: `witness foo(): Type;`
export function extractWitnesses(code: string): { name: string; type: string }[] {
  const witnesses: { name: string; type: string }[] = [];
  const witnessRegex = /witness\s+(\w+)\s*\([^)]*\)\s*:\s*([^;]+);/g;
  let match;

  while ((match = witnessRegex.exec(code)) !== null) {
    witnesses.push({
      name: match[1],
      type: match[2].trim(),
    });
  }

  return witnesses;
}

/** Build a standard log entry. */
export function makeLog(
  level: LogLevel,
  message: string,
  source?: string,
): LogEntry {
  return { id: generateId(), timestamp: Date.now(), level, message, source };
}
