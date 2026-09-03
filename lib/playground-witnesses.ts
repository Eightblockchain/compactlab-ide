/**
 * Playground witness helpers — parse user-supplied private inputs and
 * build Compact witness functions from declared `witness` specs.
 *
 * Encoding is shared with constructor/circuit args via compact-values.
 */

import {
  bytesLengthFromType,
  compactValueKind,
  generateBytesHex,
  parseCompactValue,
  validateCompactParams,
  type CompactParamSpec,
  type CompactValueKind,
} from "@/lib/compact-values";

export type WitnessSpec = CompactParamSpec;

/** @deprecated Use CompactValueKind — kept for WitnessInputRow compat. */
export type WitnessFieldKind = "bytes" | "boolean" | "integer" | "string" | "unknown";

export type PlaygroundPrivateState = Record<string, unknown>;

export function witnessFieldKind(type: string): WitnessFieldKind {
  const kind = compactValueKind(type);
  if (kind === "boolean" || kind === "bytes" || kind === "integer" || kind === "string") {
    return kind;
  }
  if (kind === "coinPublicKey" || kind === "contractAddress") return "bytes";
  return "unknown";
}

export { bytesLengthFromType, generateBytesHex };

export function parseWitnessValue(type: string, raw: string): unknown {
  return parseCompactValue(type, raw);
}

/** Returns an error message if any declared witness is missing or invalid. */
export function validateWitnessValues(
  specs: WitnessSpec[],
  values: Record<string, string>,
): string | null {
  if (specs.length === 0) return null;
  const err = validateCompactParams(specs, values, "Witness");
  if (!err) return null;
  if (err.startsWith("Set witness value")) {
    return err.replace(
      "Set witness value(s):",
      "Set private witness value(s) in Contract UI:",
    );
  }
  return err;
}

/**
 * SDK placeholder private state for deploy when constructor does not read witnesses.
 * Matches official bboard: randomBytes(32) seeded without prompting the user.
 */
export function createPlaceholderPrivateState(specs: WitnessSpec[]): PlaygroundPrivateState {
  const state: PlaygroundPrivateState = {};
  for (const spec of specs) {
    const kind = compactValueKind(spec.type);
    if (kind === "bytes") {
      const len = bytesLengthFromType(spec.type) ?? 32;
      state[spec.name] = crypto.getRandomValues(new Uint8Array(len));
    } else if (kind === "boolean") {
      state[spec.name] = false;
    } else if (kind === "integer") {
      state[spec.name] = BigInt(0);
    } else if (kind === "coinPublicKey" || kind === "contractAddress") {
      state[spec.name] = { bytes: crypto.getRandomValues(new Uint8Array(32)) };
    } else {
      state[spec.name] = "";
    }
  }
  return state;
}

/**
 * Prefer complete user form values; otherwise return null (caller may use placeholder).
 */
export function tryBuildPrivateStateFromValues(
  specs: WitnessSpec[],
  values: Record<string, string> | undefined,
): PlaygroundPrivateState | null {
  if (validateWitnessValues(specs, values ?? {}) !== null) return null;
  return buildPrivateStateFromValues(specs, values ?? {});
}

export function buildPrivateStateFromValues(
  specs: WitnessSpec[],
  values: Record<string, string>,
): PlaygroundPrivateState {
  const err = validateWitnessValues(specs, values);
  if (err) throw new Error(err);
  const state: PlaygroundPrivateState = {};
  for (const spec of specs) {
    state[spec.name] = parseWitnessValue(spec.type, values[spec.name] ?? "");
  }
  return state;
}

/** Witness fns that return `privateState[name]` for each declared witness. */
export function buildWitnessFunctions(specs: WitnessSpec[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const witnesses: Record<string, (ctx: any) => [PlaygroundPrivateState, unknown]> = {};
  for (const { name } of specs) {
    witnesses[name] = ({ privateState }: { privateState: PlaygroundPrivateState }) => [
      privateState,
      privateState[name],
    ];
  }
  return witnesses;
}

/** Serialize private state for localStorage backup (Uint8Array → hex). */
export function serializePrivateState(state: PlaygroundPrivateState): string {
  const out: Record<string, { t: string; v: string }> = {};
  for (const [k, v] of Object.entries(state)) {
    if (v instanceof Uint8Array) out[k] = { t: "bytes", v: Array.from(v, (b) => b.toString(16).padStart(2, "0")).join("") };
    else if (typeof v === "boolean") out[k] = { t: "bool", v: v ? "true" : "false" };
    else if (typeof v === "bigint") out[k] = { t: "bigint", v: v.toString() };
    else if (v && typeof v === "object" && "bytes" in (v as object) && (v as { bytes: unknown }).bytes instanceof Uint8Array) {
      const bytes = (v as { bytes: Uint8Array }).bytes;
      out[k] = {
        t: "coin",
        v: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
      };
    } else out[k] = { t: "string", v: String(v) };
  }
  return JSON.stringify(out);
}

export function deserializePrivateState(raw: string): PlaygroundPrivateState | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, { t: string; v: string }>;
    const state: PlaygroundPrivateState = {};
    for (const [k, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.t !== "string") return null;
      if (entry.t === "bytes") {
        const hex = entry.v;
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) {
          out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        state[k] = out;
      } else if (entry.t === "coin") {
        const hex = entry.v;
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) {
          out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        state[k] = { bytes: out };
      } else if (entry.t === "bool") state[k] = entry.v === "true";
      else if (entry.t === "bigint") state[k] = BigInt(entry.v);
      else state[k] = entry.v;
    }
    return state;
  } catch {
    return null;
  }
}

/**
 * Merge declared specs with detected constructor witness names.
 * Prefer source specs (have types); fill any extra names as Bytes<32>.
 */
export function mergeWitnessSpecs(
  fromSource: WitnessSpec[],
  detectedNames: string[],
): WitnessSpec[] {
  const byName = new Map(fromSource.map((s) => [s.name, s]));
  for (const name of detectedNames) {
    if (!byName.has(name)) {
      byName.set(name, { name, type: "Bytes<32>" });
    }
  }
  const ordered: WitnessSpec[] = [];
  for (const s of fromSource) ordered.push(byName.get(s.name)!);
  for (const name of detectedNames) {
    if (!fromSource.some((s) => s.name === name)) ordered.push(byName.get(name)!);
  }
  return ordered.length > 0 ? ordered : detectedNames.map((name) => ({ name, type: "Bytes<32>" }));
}

// silence unused type import warning in some TS configs
export type { CompactValueKind };
