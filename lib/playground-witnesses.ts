/**
 * Playground witness helpers — parse user-supplied private inputs and
 * build Compact witness functions from declared `witness` specs.
 */

import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-utils";

export type WitnessSpec = { name: string; type: string };

export type WitnessFieldKind = "bytes" | "boolean" | "integer" | "string" | "unknown";

export type PlaygroundPrivateState = Record<string, unknown>;

export function witnessFieldKind(type: string): WitnessFieldKind {
  const t = type.trim();
  if (/^Boolean$/i.test(t) || /^Bool$/i.test(t)) return "boolean";
  if (/^Bytes<\s*\d+\s*>$/i.test(t)) return "bytes";
  if (/^(Uint|Field|Counter|Unsigned|Nat)(<|$)/i.test(t)) return "integer";
  if (/Opaque\s*<\s*["']string["']\s*>/i.test(t)) return "string";
  return "unknown";
}

export function bytesLengthFromType(type: string): number | null {
  const m = type.trim().match(/^Bytes<\s*(\d+)\s*>$/i);
  return m ? Number(m[1]) : null;
}

/** Random hex for Bytes<N> (no 0x prefix). */
export function generateBytesHex(byteLength = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function parseWitnessValue(type: string, raw: string): unknown {
  const kind = witnessFieldKind(type);
  const value = raw.trim();

  if (kind === "boolean") {
    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
    throw new Error(`Expected true/false for Boolean, got "${raw}"`);
  }

  if (kind === "bytes") {
    const len = bytesLengthFromType(type) ?? 32;
    const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
    if (!/^[0-9a-fA-F]*$/.test(hex)) {
      throw new Error(`Expected hex for ${type}`);
    }
    if (hex.length !== len * 2) {
      throw new Error(`${type} needs ${len * 2} hex chars (got ${hex.length})`);
    }
    return fromHex(hex);
  }

  if (kind === "integer") {
    if (!/^-?\d+$/.test(value)) {
      throw new Error(`Expected integer for ${type}, got "${raw}"`);
    }
    return BigInt(value);
  }

  // string / unknown — pass through as Opaque string / raw
  return value;
}

/** Returns an error message if any declared witness is missing or invalid. */
export function validateWitnessValues(
  specs: WitnessSpec[],
  values: Record<string, string>,
): string | null {
  if (specs.length === 0) return null;
  const missing = specs.filter((s) => !(values[s.name] ?? "").trim());
  if (missing.length > 0) {
    return `Set private witness value(s) in Contract UI before Call: ${missing.map((m) => m.name).join(", ")}`;
  }
  for (const spec of specs) {
    try {
      parseWitnessValue(spec.type, values[spec.name] ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Witness "${spec.name}": ${msg}`;
    }
  }
  return null;
}

/**
 * SDK placeholder private state for deploy (constructor rarely reads witnesses).
 * Matches official bboard: randomBytes(32) seeded without prompting the user.
 */
export function createPlaceholderPrivateState(specs: WitnessSpec[]): PlaygroundPrivateState {
  const state: PlaygroundPrivateState = {};
  for (const spec of specs) {
    const kind = witnessFieldKind(spec.type);
    if (kind === "bytes") {
      const len = bytesLengthFromType(spec.type) ?? 32;
      state[spec.name] = crypto.getRandomValues(new Uint8Array(len));
    } else if (kind === "boolean") {
      state[spec.name] = false;
    } else if (kind === "integer") {
      state[spec.name] = BigInt(0);
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
    if (v instanceof Uint8Array) out[k] = { t: "bytes", v: toHex(v) };
    else if (typeof v === "boolean") out[k] = { t: "bool", v: v ? "true" : "false" };
    else if (typeof v === "bigint") out[k] = { t: "bigint", v: v.toString() };
    else out[k] = { t: "string", v: String(v) };
  }
  return JSON.stringify(out);
}

export function deserializePrivateState(raw: string): PlaygroundPrivateState | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, { t: string; v: string }>;
    const state: PlaygroundPrivateState = {};
    for (const [k, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.t !== "string") return null;
      if (entry.t === "bytes") state[k] = fromHex(entry.v);
      else if (entry.t === "bool") state[k] = entry.v === "true";
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
  // Preserve source order, then any extras
  const ordered: WitnessSpec[] = [];
  for (const s of fromSource) ordered.push(byName.get(s.name)!);
  for (const name of detectedNames) {
    if (!fromSource.some((s) => s.name === name)) ordered.push(byName.get(name)!);
  }
  return ordered.length > 0 ? ordered : detectedNames.map((name) => ({ name, type: "Bytes<32>" }));
}
