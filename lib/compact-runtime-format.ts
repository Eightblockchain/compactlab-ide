/**
 * Pretty-print Compact runtime / ledger values for the Contract panel.
 * Handles scalars, Maybe/Either, byte keys, and Map/Set-style collections
 * exposed by generated `ledger()`.
 */

const MAX_DEPTH = 8;
const MAX_ENTRIES = 80;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isIterable(value: object): value is Iterable<unknown> {
  return typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function";
}

/**
 * Convert a Compact JS value into JSON-serializable data (bigints as strings).
 */
export function compactRuntimeToJson(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (value instanceof Uint8Array) return toHex(value);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ENTRIES).map((item) => compactRuntimeToJson(item, depth + 1, seen));
  }

  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "(circular)";
  if (depth > MAX_DEPTH) return "(nested)";
  seen.add(value);

  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    let i = 0;
    for (const [k, v] of value) {
      if (i++ >= MAX_ENTRIES) break;
      out[String(compactRuntimeToJson(k, depth + 1, seen))] = compactRuntimeToJson(
        v,
        depth + 1,
        seen,
      );
    }
    return out;
  }
  if (value instanceof Set) {
    return [...value]
      .slice(0, MAX_ENTRIES)
      .map((item) => compactRuntimeToJson(item, depth + 1, seen));
  }

  const rec = value as Record<string, unknown>;

  if (rec.bytes instanceof Uint8Array) {
    return toHex(rec.bytes);
  }

  if (typeof rec.is_some === "boolean") {
    return rec.is_some
      ? { is_some: true, value: compactRuntimeToJson(rec.value, depth + 1, seen) }
      : { is_some: false };
  }

  if (typeof rec.is_left === "boolean") {
    return rec.is_left
      ? { is_left: true, left: compactRuntimeToJson(rec.left, depth + 1, seen) }
      : { is_left: false, right: compactRuntimeToJson(rec.right, depth + 1, seen) };
  }

  if (typeof rec.keys === "function" && typeof rec.lookup === "function") {
    try {
      const keys = [...(rec.keys() as Iterable<unknown>)];
      const out: Record<string, unknown> = {};
      for (const [i, key] of keys.entries()) {
        if (i >= MAX_ENTRIES) break;
        const k = String(compactRuntimeToJson(key, depth + 1, seen));
        out[k] = compactRuntimeToJson(rec.lookup(key), depth + 1, seen);
      }
      return { size: String(keys.length), entries: out };
    } catch {
      /* fall through */
    }
  }

  if (isIterable(value)) {
    try {
      const items: unknown[] = [];
      let i = 0;
      for (const item of value) {
        if (i++ >= MAX_ENTRIES) {
          items.push("…");
          break;
        }
        items.push(compactRuntimeToJson(item, depth + 1, seen));
      }
      if (
        items.length > 0 &&
        items.every((it) => Array.isArray(it) && it.length === 2)
      ) {
        const asMap: Record<string, unknown> = {};
        for (const pair of items as Array<[unknown, unknown]>) {
          asMap[String(pair[0])] = pair[1];
        }
        return asMap;
      }
      return items;
    } catch {
      /* fall through */
    }
  }

  if (typeof rec.size === "function") {
    try {
      const size = rec.size();
      if (size === BigInt(0) || size === 0) return { size: "0", entries: [] };
    } catch {
      /* ignore */
    }
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === "function" || k.startsWith("_")) continue;
    out[k] = compactRuntimeToJson(v, depth + 1, seen);
  }
  if (Object.keys(out).length > 0) return out;

  try {
    const s = String(value);
    if (s && s !== "[object Object]") return s;
  } catch {
    /* ignore */
  }
  return {};
}

/** Human-readable ledger / circuit-return display. */
export function formatCompactRuntimeValue(value: unknown): string {
  if (value === undefined) return "(none)";
  const json = compactRuntimeToJson(value);
  if (json === null) return "(none)";
  if (typeof json === "string") return json;
  if (typeof json === "number" || typeof json === "boolean") return String(json);
  if (Array.isArray(json) && json.length === 0) return "[]";
  try {
    return JSON.stringify(json, null, 2);
  } catch {
    return String(json);
  }
}

export function formatLedgerSnapshot(ledger: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(ledger)) {
    try {
      out[key] = formatCompactRuntimeValue(ledger[key]);
    } catch (err) {
      out[key] = `(unavailable: ${err instanceof Error ? err.message : String(err)})`;
    }
  }
  return out;
}

export function isVoidCircuitOutput(output?: string): boolean {
  const t = (output ?? "[]").trim();
  return t === "" || t === "[]" || t === "void" || t === "Unit" || t === "()";
}
