/**
 * Constructor parameter discovery + witness-at-ctor heuristics for Deploy.
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

/** Extract constructor params from Compact source. Empty array if none / empty ctor. */
export function extractConstructorParams(code: string): CompactParamSpec[] {
  const ctor = extractCircuitBodies(code).find((b) => b.isConstructor);
  if (!ctor) return [];
  return ctor.params.map((p) => ({ name: p.name, type: p.type }));
}

/**
 * Heuristic: constructor (or top-level helpers referenced from it) call witness names.
 * Prefer requiring real witness values at Deploy when this is true.
 */
export function constructorWitnessUsage(
  code: string,
  witnessNames: string[],
): { usesWitnesses: boolean; witnessNamesUsed: string[] } {
  if (witnessNames.length === 0) {
    return { usesWitnesses: false, witnessNamesUsed: [] };
  }
  const bodies = extractCircuitBodies(code);
  const ctor = bodies.find((b) => b.isConstructor);
  if (!ctor) {
    return { usesWitnesses: false, witnessNamesUsed: [] };
  }

  const used = new Set<string>();
  const scanBody = (body: string) => {
    for (const name of witnessNames) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`, "g");
      if (re.test(body)) used.add(name);
    }
  };

  scanBody(ctor.body);

  // One-level helper expansion: functions called from constructor
  const callNames = new Set<string>();
  const callRe = /\b([A-Za-z_]\w*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(ctor.body)) !== null) {
    callNames.add(m[1]!);
  }
  for (const helper of bodies) {
    if (helper.isConstructor) continue;
    if (callNames.has(helper.name)) scanBody(helper.body);
  }

  // Also: witness name referenced without call (rare) — treat as used if identifier appears in ctor
  for (const name of witnessNames) {
    if (used.has(name)) continue;
    const locs = findIdentifierOccurrences(ctor.body, name);
    if (locs.length > 0) used.add(name);
  }

  const witnessNamesUsed = [...used];
  return { usesWitnesses: witnessNamesUsed.length > 0, witnessNamesUsed };
}

export function getConstructorMeta(
  code: string,
  witnessNames: string[] = [],
): ConstructorMeta {
  const inputs = extractConstructorParams(code);
  const usage = constructorWitnessUsage(
    code,
    witnessNames.length > 0
      ? witnessNames
      : // fall back: any witness() call pattern is unknown without names
        [],
  );
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
