/**
 * Constructor / circuit parameter discovery + which witnesses each body calls.
 */

import { extractCircuitBodies, findIdentifierOccurrences } from "@/lib/compact-symbols";
import {
  parseInitialStateParamsFromDts,
  type CompactParamSpec,
} from "@/lib/compact-values";

export type ConstructorMeta = {
  inputs: CompactParamSpec[];
  /** True when constructor body (or reachable helpers we can see) call witness(es). */
  usesWitnesses: boolean;
  witnessNamesUsed: string[];
};

export type CircuitWitnessUsage = {
  usesWitnesses: boolean;
  witnessNamesUsed: string[];
};

/** Extract constructor params from Compact source. Empty array if none / empty ctor. */
export function extractConstructorParams(code: string): CompactParamSpec[] {
  const ctor = extractCircuitBodies(code).find((b) => b.isConstructor);
  if (!ctor) return [];
  return ctor.params.map((p) => ({ name: p.name, type: p.type }));
}

/**
 * Which witnesses a circuit (or constructor) body actually calls.
 * Walks helper circuits referenced from the entry body (bounded depth).
 */
export function circuitWitnessUsage(
  code: string,
  entryName: string,
  witnessNames: string[],
  options?: { maxHelperDepth?: number },
): CircuitWitnessUsage {
  if (witnessNames.length === 0) {
    return { usesWitnesses: false, witnessNamesUsed: [] };
  }
  const bodies = extractCircuitBodies(code);
  const entry =
    entryName === "constructor"
      ? bodies.find((b) => b.isConstructor)
      : bodies.find((b) => !b.isConstructor && b.name === entryName);
  if (!entry) {
    return { usesWitnesses: false, witnessNamesUsed: [] };
  }

  const witnessSet = new Set(witnessNames);
  const used = new Set<string>();
  const maxDepth = options?.maxHelperDepth ?? 4;

  const scanBody = (body: string) => {
    for (const name of witnessNames) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`, "g");
      if (re.test(body)) used.add(name);
    }
  };

  const collectCalls = (body: string): string[] => {
    const names: string[] = [];
    const callRe = /\b([A-Za-z_]\w*)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = callRe.exec(body)) !== null) {
      const n = m[1]!;
      if (witnessSet.has(n)) continue;
      names.push(n);
    }
    return names;
  };

  const visited = new Set<string>();
  const queue: Array<{ name: string; body: string; depth: number }> = [
    { name: entry.name, body: entry.body, depth: 0 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur.name)) continue;
    visited.add(cur.name);
    scanBody(cur.body);

    if (cur.depth >= maxDepth) continue;
    for (const callName of collectCalls(cur.body)) {
      if (visited.has(callName)) continue;
      const helper = bodies.find((b) => !b.isConstructor && b.name === callName);
      if (helper) {
        queue.push({ name: helper.name, body: helper.body, depth: cur.depth + 1 });
      }
    }
  }

  // Identifier mentions without call (rare) in the entry body only
  for (const name of witnessNames) {
    if (used.has(name)) continue;
    const locs = findIdentifierOccurrences(entry.body, name);
    if (locs.length > 0) used.add(name);
  }

  const witnessNamesUsed = [...used];
  return { usesWitnesses: witnessNamesUsed.length > 0, witnessNamesUsed };
}

/** @deprecated Prefer circuitWitnessUsage(code, "constructor", …) */
export function constructorWitnessUsage(
  code: string,
  witnessNames: string[],
): CircuitWitnessUsage {
  return circuitWitnessUsage(code, "constructor", witnessNames);
}

export function getConstructorMeta(
  code: string,
  witnessNames: string[] = [],
): ConstructorMeta {
  const inputs = extractConstructorParams(code);
  const usage = circuitWitnessUsage(code, "constructor", witnessNames);
  return {
    inputs,
    usesWitnesses: usage.usesWitnesses,
    witnessNamesUsed: usage.witnessNamesUsed,
  };
}

/**
 * Resolve constructor params for Deploy UI / encoding.
 * Prefer Compact source (best types); then compile metadata; then generated .d.ts.
 */
export function resolveConstructorParams(options: {
  code?: string | null;
  constructorMetadata?: CompactParamSpec[] | null;
  generatedDts?: string | null;
}): CompactParamSpec[] {
  const fromSource = options.code ? extractConstructorParams(options.code) : [];
  if (fromSource.length > 0) return fromSource;

  if (options.constructorMetadata && options.constructorMetadata.length > 0) {
    return options.constructorMetadata;
  }

  if (options.generatedDts) {
    return parseInitialStateParamsFromDts(options.generatedDts);
  }

  // Empty constructor / no constructor → no args
  if (options.code) {
    const ctor = extractCircuitBodies(options.code).find((b) => b.isConstructor);
    if (ctor) return ctor.params; // may be empty
  }

  return options.constructorMetadata ?? [];
}

/** Strip `_0` suffixes that Compact codegen adds to param names. */
export function stripCodegenParamSuffix(name: string): string {
  return name.replace(/_\d+$/, "");
}
