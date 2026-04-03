import { sleep, generateId } from "./utils";

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

// Deterministic hash of a string → number (no Math.random, avoids SSR hydration mismatch)
function deterministicHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // convert to 32-bit int
  }
  return Math.abs(hash);
}

// Extract circuits from Compact code (mock parser)
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
      constraints: (deterministicHash(name) % 150) + 50,
      isExported: true,
    });
  }

  return circuits;
}

// Extract ledger variables from code (mock parser)
export function extractLedgerVars(code: string): { name: string; type: string; isPublic: boolean }[] {
  const vars: { name: string; type: string; isPublic: boolean }[] = [];
  const ledgerRegex = /ledger\s+(\w+)\s*:\s*([^;]+);/g;
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

// Extract witness variables from code (mock parser)
export function extractWitnesses(code: string): { name: string; type: string }[] {
  const witnesses: { name: string; type: string }[] = [];
  const witnessRegex = /witness\s+(\w+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = witnessRegex.exec(code)) !== null) {
    witnesses.push({
      name: match[1],
      type: match[2].trim(),
    });
  }

  return witnesses;
}

// Mock compile function
export async function mockCompile(
  code: string,
  onLog: (log: LogEntry) => void
): Promise<CompileResult> {
  const start = Date.now();

  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Starting compilation...", source: "compiler" });
  await sleep(300);

  // Check for syntax errors (very basic mock)
  const hasContractDecl = /contract\s+\w+/.test(code);
  const hasPragma = /pragma language_version/.test(code);

  if (!hasPragma) {
    onLog({ id: generateId(), timestamp: Date.now(), level: "warn", message: "Missing pragma language_version declaration", source: "compiler" });
  }

  if (!hasContractDecl) {
    onLog({ id: generateId(), timestamp: Date.now(), level: "error", message: "No contract declaration found", source: "compiler" });
    return {
      success: false,
      duration: Date.now() - start,
      errors: [{ line: 1, column: 1, message: "Expected 'contract' declaration", severity: "error" }],
    };
  }

  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Parsing AST...", source: "compiler" });
  await sleep(200);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Type checking...", source: "compiler" });
  await sleep(250);

  const circuits = extractCircuits(code);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: `Found ${circuits.length} circuit(s)`, source: "compiler" });
  await sleep(200);

  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Generating constraint system...", source: "compiler" });
  await sleep(400);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Optimizing constraints...", source: "compiler" });
  await sleep(200);

  const totalConstraints = circuits.reduce((sum, c) => sum + c.constraints, 0);
  
  onLog({ id: generateId(), timestamp: Date.now(), level: "success", message: `Compilation successful — ${totalConstraints} constraints generated`, source: "compiler" });
  
  return {
    success: true,
    duration: Date.now() - start,
    constraintCount: totalConstraints,
    circuitMetadata: circuits,
    warnings: code.length > 2000 ? ["Contract size is large, consider splitting into modules"] : [],
  };
}

// Mock simulate function
export async function mockSimulate(
  circuitName: string,
  inputs: Record<string, string>,
  onLog: (log: LogEntry) => void
): Promise<SimulateResult> {
  const start = Date.now();

  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: `Simulating circuit: ${circuitName}`, source: "simulator" });
  await sleep(200);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Building witness...", source: "simulator" });
  await sleep(300);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Generating ZK proof...", source: "simulator" });
  await sleep(500);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Verifying proof...", source: "simulator" });
  await sleep(200);

  const outputVal = Object.values(inputs)[0] ? parseInt(Object.values(inputs)[0] as string, 10) + 1 : 1;

  onLog({ id: generateId(), timestamp: Date.now(), level: "success", message: `Circuit executed successfully. Output: ${outputVal}`, source: "simulator" });

  return {
    success: true,
    output: outputVal,
    logs: [],
    gasUsed: Math.floor(Math.random() * 5000) + 1000,
    duration: Date.now() - start,
    stateChanges: [
      { key: "counter", before: "0", after: String(outputVal) },
    ],
  };
}

// Mock deploy function
export async function mockDeploy(
  onLog: (log: LogEntry) => void
): Promise<DeployResult> {
  const start = Date.now();

  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Connecting to Midnight Devnet...", source: "network" });
  await sleep(400);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Wallet signing transaction...", source: "network" });
  await sleep(600);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Submitting contract bytecode...", source: "network" });
  await sleep(800);
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Waiting for block confirmation...", source: "network" });
  await sleep(1200);

  const contractAddress = `0x${Math.random().toString(16).slice(2, 42).padEnd(40, "0")}`;
  const txHash = `0x${Math.random().toString(16).slice(2, 66).padEnd(64, "0")}`;

  onLog({ id: generateId(), timestamp: Date.now(), level: "success", message: `Contract deployed at ${contractAddress}`, source: "network" });
  onLog({ id: generateId(), timestamp: Date.now(), level: "info", message: `Transaction: ${txHash}`, source: "network" });

  return {
    success: true,
    contractAddress,
    transactionHash: txHash,
    blockNumber: Math.floor(Math.random() * 10000) + 50000,
    gasUsed: Math.floor(Math.random() * 50000) + 10000,
    duration: Date.now() - start,
  };
}
