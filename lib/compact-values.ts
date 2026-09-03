/**
 * Shared Compact → JS value codec for constructor args, circuit args, and witnesses.
 *
 * Shapes verified against Compact compiler 0.30.0 generated TypeScript / contract-info:
 * - Boolean → boolean
 * - Uint/Field → bigint
 * - Bytes<N> → Uint8Array
 * - Opaque<"string"> → string
 * - ZswapCoinPublicKey / ContractAddress → { bytes: Uint8Array }
 * - Vector<N,T> → T[] (exact length N)
 * - [T1,…,Tn] Tuple → fixed-length array
 * - struct S {…} → plain object { field: … }
 * - enum E {…} → number (0-based ordinal); form may use name or number
 * - Maybe<T> → { is_some: boolean, value: T }  (compiler emits as Struct "Maybe")
 * - Either<L,R> → { is_left: boolean, left: L, right: R } (Struct "Either")
 *
 * Ledger-state types (Map, Set, MerkleTree, List, Counter, …) are not circuit/ctor
 * argument types in Compact — rejected explicitly.
 */

export type CompactTypeSchema = {
  "type-name"?: string;
  tsType?: string;
  length?: number;
  maxval?: number | string;
  /** Struct or Enum name (Point, Maybe, Either, Arrow, …). */
  name?: string;
  /** Vector element type. */
  type?: CompactTypeSchema;
  /** Tuple element types. */
  types?: CompactTypeSchema[];
  /**
   * Struct: { name, type }[]; Enum: string[] variant names.
   * (Matches contract-info.json from compactc.)
   */
  elements?: Array<{ name: string; type?: CompactTypeSchema } | string>;
};

export type CompactEnumDecl = { name: string; variants: string[] };
export type CompactStructDecl = {
  name: string;
  fields: Array<{ name: string; type: string }>;
};

export type CompactTypeEnv = {
  enums?: CompactEnumDecl[];
  structs?: CompactStructDecl[];
};

export type CompactParamSpec = {
  name: string;
  /** Display / Compact-ish type string. */
  type: string;
  /** Nested schema from contract-info when available. */
  typeSchema?: CompactTypeSchema;
};

export type CompactValueKind =
  | "boolean"
  | "bytes"
  | "integer"
  | "string"
  | "coinPublicKey"
  | "contractAddress"
  | "vector"
  | "tuple"
  | "struct"
  | "enum"
  | "maybe"
  | "either"
  | "json" // composite without finer classification
  | "unsupported";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function normalizeCompactType(type: string): string {
  return type.trim().replace(/\s+/g, " ");
}

export function bytesLengthFromType(type: string): number | null {
  const m = normalizeCompactType(type).match(/^Bytes<\s*(\d+)\s*>$/i);
  return m ? Number(m[1]) : null;
}

/** Ledger-state types — not valid as circuit/constructor parameter values. */
export function isLedgerStateTypeName(name: string): boolean {
  return /^(Map|Set|MerkleTree|List|Counter|Cell|Kernel|HistoricMerkleTree)$/i.test(
    name.trim(),
  );
}

export function formatCompilerArgType(type?: CompactTypeSchema | null): string {
  if (!type) return "unknown";
  const name = type["type-name"];
  if (name === "Opaque" && type.tsType === "string") return 'Opaque<"string">';
  if (name === "Opaque" && type.tsType === "Uint8Array") return 'Opaque<"Uint8Array">';
  if (name === "Opaque" && type.tsType) return `Opaque<"${type.tsType}">`;
  if (name === "Bytes") {
    if (typeof type.length === "number") return `Bytes<${type.length}>`;
    return "Bytes<32>";
  }
  if (name === "Boolean" || name === "Bool") return "Boolean";
  if (name === "ZswapCoinPublicKey") return "ZswapCoinPublicKey";
  if (name === "ContractAddress") return "ContractAddress";
  if (name === "Vector" && type.type && typeof type.length === "number") {
    return `Vector<${type.length}, ${formatCompilerArgType(type.type)}>`;
  }
  if (name === "Tuple" && Array.isArray(type.types)) {
    return `[${type.types.map((t) => formatCompilerArgType(t)).join(", ")}]`;
  }
  if (name === "Struct" && type.name) {
    if (type.name === "Maybe" && Array.isArray(type.elements)) {
      const valueEl = type.elements.find(
        (e) => typeof e === "object" && e.name === "value",
      ) as { name: string; type?: CompactTypeSchema } | undefined;
      return `Maybe<${formatCompilerArgType(valueEl?.type)}>`;
    }
    if (type.name === "Either" && Array.isArray(type.elements)) {
      const left = type.elements.find(
        (e) => typeof e === "object" && e.name === "left",
      ) as { name: string; type?: CompactTypeSchema } | undefined;
      const right = type.elements.find(
        (e) => typeof e === "object" && e.name === "right",
      ) as { name: string; type?: CompactTypeSchema } | undefined;
      return `Either<${formatCompilerArgType(left?.type)}, ${formatCompilerArgType(right?.type)}>`;
    }
    return type.name;
  }
  if (name === "Enum" && type.name) return type.name;
  if (name === "Uint" || name === "Field") {
    const maxRaw = type.maxval;
    if (maxRaw !== undefined && maxRaw !== null) {
      try {
        const max = BigInt(maxRaw);
        for (const w of [8, 16, 32, 64, 128, 256] as const) {
          if (max === (BigInt(1) << BigInt(w)) - BigInt(1)) {
            return name === "Field" ? "Field" : `Uint<${w}>`;
          }
        }
      } catch {
        /* ignore */
      }
    }
    return name === "Field" ? "Field" : "Uint";
  }
  if (type.tsType === "string") return 'Opaque<"string">';
  if (type.tsType === "bigint") return "Uint";
  if (type.tsType === "boolean") return "Boolean";
  if (type.tsType) return type.tsType;
  return name ?? "unknown";
}

export function compactValueKind(
  type: string,
  schema?: CompactTypeSchema | null,
  env?: CompactTypeEnv,
): CompactValueKind {
  if (schema?.["type-name"]) {
    const n = schema["type-name"];
    if (isLedgerStateTypeName(n) || isLedgerStateTypeName(schema.name ?? "")) {
      return "unsupported";
    }
    if (n === "Boolean" || n === "Bool") return "boolean";
    if (n === "Bytes") return "bytes";
    if (n === "Opaque" && schema.tsType === "string") return "string";
    if (n === "Opaque" && schema.tsType === "Uint8Array") return "bytes";
    if (n === "Uint" || n === "Field") return "integer";
    if (n === "ZswapCoinPublicKey") return "coinPublicKey";
    if (n === "ContractAddress") return "contractAddress";
    if (n === "Vector") return "vector";
    if (n === "Tuple") return "tuple";
    if (n === "Enum") return "enum";
    if (n === "Struct") {
      if (schema.name === "Maybe") return "maybe";
      if (schema.name === "Either") return "either";
      return "struct";
    }
  }

  const t = normalizeCompactType(type);
  if (!t || t === "unknown" || t === "Unknown") return "unsupported";
  if (isLedgerStateTypeName(t.split("<")[0] ?? t)) return "unsupported";
  if (/^Boolean$/i.test(t) || /^Bool$/i.test(t)) return "boolean";
  if (/^Bytes<\s*\d+\s*>$/i.test(t) || /^Bytes$/i.test(t)) return "bytes";
  if (/^Opaque\s*<\s*["']Uint8Array["']\s*>$/i.test(t)) return "bytes";
  if (/^(Uint|Field|Unsigned|Nat)(<|$)/i.test(t) || /^bigint$/i.test(t)) return "integer";
  if (/^string$/i.test(t) || /Opaque\s*<\s*["']string["']\s*>/i.test(t)) return "string";
  if (/^ZswapCoinPublicKey$/i.test(t) || /EncodedCoinPublicKey/i.test(t)) return "coinPublicKey";
  if (/^ContractAddress$/i.test(t)) return "contractAddress";
  if (/^Vector\s*</i.test(t)) return "vector";
  if (/^\[/.test(t)) return "tuple";
  if (/^Maybe\s*</i.test(t)) return "maybe";
  if (/^Either\s*</i.test(t)) return "either";
  if (env?.enums?.some((e) => e.name === t)) return "enum";
  if (env?.structs?.some((s) => s.name === t)) return "struct";
  // User-defined type name without env — allow JSON attempt only if looks like identifier
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t) && !/^(Map|Set|List|Counter)$/i.test(t)) {
    return "json";
  }
  return "unsupported";
}

export function isCompositeCompactKind(kind: CompactValueKind): boolean {
  return (
    kind === "vector" ||
    kind === "tuple" ||
    kind === "struct" ||
    kind === "enum" ||
    kind === "maybe" ||
    kind === "either" ||
    kind === "json"
  );
}

export function isSupportedCompactType(
  type: string,
  schema?: CompactTypeSchema | null,
  env?: CompactTypeEnv,
): boolean {
  return compactValueKind(type, schema, env) !== "unsupported";
}

/** Build a JSON example string matching Compact/runtime expectations. */
export function exampleJsonForType(
  type: string,
  schema?: CompactTypeSchema | null,
  env?: CompactTypeEnv,
): string {
  const kind = compactValueKind(type, schema, env);
  try {
    const ex = exampleValue(kind, type, schema, env);
    return JSON.stringify(ex, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  } catch {
    return "{\n  \n}";
  }
}

function exampleValue(
  kind: CompactValueKind,
  type: string,
  schema?: CompactTypeSchema | null,
  env?: CompactTypeEnv,
): unknown {
  switch (kind) {
    case "boolean":
      return true;
    case "integer":
      return 0;
    case "string":
      return "hello";
    case "bytes": {
      const len = schema?.length ?? bytesLengthFromType(type) ?? 32;
      return "00".repeat(len);
    }
    case "coinPublicKey":
    case "contractAddress":
      return "00".repeat(32);
    case "enum": {
      if (schema?.elements && typeof schema.elements[0] === "string") {
        return schema.elements[0];
      }
      const decl = env?.enums?.find((e) => e.name === normalizeCompactType(type));
      return decl?.variants[0] ?? 0;
    }
    case "vector": {
      const n = schema?.length ?? parseVectorLength(type) ?? 2;
      const elType = schema?.type;
      const elKind = elType
        ? compactValueKind(formatCompilerArgType(elType), elType, env)
        : compactValueKind(parseVectorElementType(type) ?? "Uint", undefined, env);
      const elDisp = elType ? formatCompilerArgType(elType) : parseVectorElementType(type) ?? "Uint";
      return Array.from({ length: n }, () => exampleValue(elKind, elDisp, elType, env));
    }
    case "tuple": {
      if (schema?.types) {
        return schema.types.map((t) =>
          exampleValue(compactValueKind(formatCompilerArgType(t), t, env), formatCompilerArgType(t), t, env),
        );
      }
      const parts = parseTupleTypes(type);
      return parts.map((p) => exampleValue(compactValueKind(p, undefined, env), p, undefined, env));
    }
    case "maybe": {
      const valueSchema = structFieldSchema(schema, "value");
      const valueType =
        valueSchema != null
          ? formatCompilerArgType(valueSchema)
          : parseGenericArg(type, "Maybe") ?? "Uint<32>";
      return {
        is_some: true,
        value: exampleValue(
          compactValueKind(valueType, valueSchema, env),
          valueType,
          valueSchema,
          env,
        ),
      };
    }
    case "either": {
      const leftSchema = structFieldSchema(schema, "left");
      const rightSchema = structFieldSchema(schema, "right");
      const args = parseEitherArgs(type);
      const leftType = leftSchema ? formatCompilerArgType(leftSchema) : args?.[0] ?? "Boolean";
      const rightType = rightSchema ? formatCompilerArgType(rightSchema) : args?.[1] ?? "Uint<8>";
      return {
        is_left: true,
        left: exampleValue(compactValueKind(leftType, leftSchema, env), leftType, leftSchema, env),
        right: exampleValue(
          compactValueKind(rightType, rightSchema, env),
          rightType,
          rightSchema,
          env,
        ),
      };
    }
    case "struct": {
      if (schema?.elements) {
        const obj: Record<string, unknown> = {};
        for (const el of schema.elements) {
          if (typeof el === "string") continue;
          const ft = formatCompilerArgType(el.type);
          obj[el.name] = exampleValue(compactValueKind(ft, el.type, env), ft, el.type, env);
        }
        return obj;
      }
      const decl = env?.structs?.find((s) => s.name === normalizeCompactType(type));
      if (decl) {
        const obj: Record<string, unknown> = {};
        for (const f of decl.fields) {
          obj[f.name] = exampleValue(compactValueKind(f.type, undefined, env), f.type, undefined, env);
        }
        return obj;
      }
      return {};
    }
    default:
      return {};
  }
}

function structFieldSchema(
  schema: CompactTypeSchema | null | undefined,
  field: string,
): CompactTypeSchema | undefined {
  if (!schema?.elements) return undefined;
  const el = schema.elements.find((e) => typeof e === "object" && e.name === field) as
    | { name: string; type?: CompactTypeSchema }
    | undefined;
  return el?.type;
}

function parseVectorLength(type: string): number | null {
  const m = normalizeCompactType(type).match(/^Vector\s*<\s*(\d+)\s*,/i);
  return m ? Number(m[1]) : null;
}

function parseVectorElementType(type: string): string | null {
  const m = normalizeCompactType(type).match(/^Vector\s*<\s*\d+\s*,\s*(.+)\s*>$/i);
  return m ? m[1]!.trim() : null;
}

function parseGenericArg(type: string, name: string): string | null {
  const m = normalizeCompactType(type).match(new RegExp(`^${name}\\s*<\\s*(.+)\\s*>$`, "i"));
  return m ? m[1]!.trim() : null;
}

function parseEitherArgs(type: string): [string, string] | null {
  const inner = parseGenericArg(type, "Either");
  if (!inner) return null;
  const parts = splitParamList(inner);
  if (parts.length !== 2) return null;
  return [parts[0]!, parts[1]!];
}

function parseTupleTypes(type: string): string[] {
  const t = normalizeCompactType(type);
  if (!t.startsWith("[") || !t.endsWith("]")) return [];
  return splitParamList(t.slice(1, -1));
}

export function placeholderForCompactType(
  type: string,
  schema?: CompactTypeSchema | null,
  env?: CompactTypeEnv,
): string {
  const kind = compactValueKind(type, schema, env);
  if (isCompositeCompactKind(kind)) {
    return "JSON value (see example)";
  }
  const len = bytesLengthFromType(type) ?? schema?.length ?? 32;
  switch (kind) {
    case "boolean":
      return "true / false";
    case "integer":
      return "0";
    case "string":
      return "hello";
    case "bytes":
      return `${len * 2} hex chars`;
    case "coinPublicKey":
    case "contractAddress":
      return "64 hex chars (32 bytes)";
    default:
      return `${normalizeCompactType(type)} (unsupported)`;
  }
}

export function generateBytesHex(byteLength = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function parseHexBytes(raw: string, len: number, label: string): Uint8Array {
  const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error(`Expected hex for ${label}`);
  if (hex.length !== len * 2) {
    throw new Error(`${label} needs ${len * 2} hex chars (got ${hex.length})`);
  }
  return fromHex(hex);
}

function parseScalarString(type: string, raw: string, schema?: CompactTypeSchema | null): unknown {
  const kind = compactValueKind(type, schema);
  const value = raw.trim();
  if (!value) throw new Error(`Missing value for type ${normalizeCompactType(type)}`);

  if (kind === "boolean") {
    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
    throw new Error(`Expected true/false for Boolean, got "${raw}"`);
  }
  if (kind === "bytes") {
    const len = schema?.length ?? bytesLengthFromType(type) ?? 32;
    return parseHexBytes(value, len, normalizeCompactType(type));
  }
  if (kind === "integer") {
    if (!/^-?\d+$/.test(value)) {
      throw new Error(`Expected integer for ${normalizeCompactType(type)}, got "${raw}"`);
    }
    return BigInt(value);
  }
  if (kind === "coinPublicKey" || kind === "contractAddress") {
    return { bytes: parseHexBytes(value, 32, normalizeCompactType(type)) };
  }
  if (kind === "string") return value;
  throw new Error(`Type ${normalizeCompactType(type)} requires a JSON value`);
}

/**
 * Encode a JSON-parsed value (or scalar string already coerced) to the JS runtime shape.
 */
export function encodeCompactJsonValue(
  type: string,
  json: unknown,
  schema?: CompactTypeSchema | null,
  env?: CompactTypeEnv,
  path = "",
): unknown {
  const kind = compactValueKind(type, schema, env);
  const at = path || "value";

  if (kind === "unsupported") {
    throw new Error(
      `${at}: type ${normalizeCompactType(type)} is not a Compact circuit/constructor argument type (ledger-state types cannot be passed as args)`,
    );
  }

  if (kind === "boolean") {
    if (typeof json === "boolean") return json;
    if (json === 0 || json === 1) return Boolean(json);
    if (typeof json === "string") return parseScalarString(type, json, schema);
    throw new Error(`${at}: expected boolean`);
  }

  if (kind === "integer") {
    if (typeof json === "bigint") return json;
    if (typeof json === "number" && Number.isInteger(json)) return BigInt(json);
    if (typeof json === "string" && /^-?\d+$/.test(json.trim())) return BigInt(json.trim());
    throw new Error(`${at}: expected integer (number or numeric string)`);
  }

  if (kind === "string") {
    if (typeof json === "string") return json;
    throw new Error(`${at}: expected string`);
  }

  if (kind === "bytes") {
    const len = schema?.length ?? bytesLengthFromType(type) ?? 32;
    if (typeof json === "string") return parseHexBytes(json, len, at);
    if (Array.isArray(json) && json.every((n) => typeof n === "number")) {
      if (json.length !== len) throw new Error(`${at}: expected ${len} bytes`);
      return Uint8Array.from(json);
    }
    throw new Error(`${at}: expected hex string for Bytes<${len}>`);
  }

  if (kind === "coinPublicKey" || kind === "contractAddress") {
    if (typeof json === "string") return { bytes: parseHexBytes(json, 32, at) };
    if (json && typeof json === "object" && "bytes" in (json as object)) {
      const b = (json as { bytes: unknown }).bytes;
      if (typeof b === "string") return { bytes: parseHexBytes(b, 32, `${at}.bytes`) };
      if (Array.isArray(b)) return { bytes: Uint8Array.from(b as number[]) };
    }
    throw new Error(`${at}: expected 64-char hex or { bytes: hex }`);
  }

  if (kind === "enum") {
    const variants =
      (schema?.elements?.filter((e) => typeof e === "string") as string[] | undefined) ??
      env?.enums?.find((e) => e.name === normalizeCompactType(type))?.variants ??
      [];
    if (typeof json === "number" && Number.isInteger(json)) {
      if (variants.length && (json < 0 || json >= variants.length)) {
        throw new Error(`${at}: enum ordinal out of range 0..${variants.length - 1}`);
      }
      return json;
    }
    if (typeof json === "string") {
      if (/^\d+$/.test(json)) return encodeCompactJsonValue(type, Number(json), schema, env, at);
      const idx = variants.indexOf(json);
      if (idx >= 0) return idx;
      if (variants.length === 0) {
        throw new Error(`${at}: unknown enum variant "${json}" (no variant list available)`);
      }
      throw new Error(`${at}: expected one of ${variants.join("|")} or 0..${variants.length - 1}`);
    }
    throw new Error(`${at}: expected enum name or ordinal`);
  }

  if (kind === "vector") {
    if (!Array.isArray(json)) throw new Error(`${at}: expected JSON array for Vector`);
    const n = schema?.length ?? parseVectorLength(type);
    if (n == null) throw new Error(`${at}: Vector length unknown`);
    if (json.length !== n) throw new Error(`${at}: expected Vector length ${n}, got ${json.length}`);
    const elSchema = schema?.type;
    const elType = elSchema ? formatCompilerArgType(elSchema) : parseVectorElementType(type) ?? "Uint";
    return json.map((el, i) =>
      encodeCompactJsonValue(elType, el, elSchema, env, `${at}[${i}]`),
    );
  }

  if (kind === "tuple") {
    if (!Array.isArray(json)) throw new Error(`${at}: expected JSON array for Tuple`);
    const elSchemas = schema?.types;
    const elTypes = elSchemas
      ? elSchemas.map((t) => formatCompilerArgType(t))
      : parseTupleTypes(type);
    if (elTypes.length === 0) throw new Error(`${at}: tuple element types unknown`);
    if (json.length !== elTypes.length) {
      throw new Error(`${at}: expected tuple length ${elTypes.length}, got ${json.length}`);
    }
    return json.map((el, i) =>
      encodeCompactJsonValue(elTypes[i]!, el, elSchemas?.[i], env, `${at}[${i}]`),
    );
  }

  if (kind === "maybe") {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new Error(`${at}: expected { is_some: boolean, value: T }`);
    }
    const obj = json as Record<string, unknown>;
    if (typeof obj.is_some !== "boolean") throw new Error(`${at}.is_some: expected boolean`);
    const valueSchema = structFieldSchema(schema, "value");
    const valueType =
      valueSchema != null
        ? formatCompilerArgType(valueSchema)
        : parseGenericArg(type, "Maybe") ?? "Uint";
    return {
      is_some: obj.is_some,
      value: encodeCompactJsonValue(valueType, obj.value, valueSchema, env, `${at}.value`),
    };
  }

  if (kind === "either") {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new Error(`${at}: expected { is_left: boolean, left: L, right: R }`);
    }
    const obj = json as Record<string, unknown>;
    if (typeof obj.is_left !== "boolean") throw new Error(`${at}.is_left: expected boolean`);
    const leftSchema = structFieldSchema(schema, "left");
    const rightSchema = structFieldSchema(schema, "right");
    const args = parseEitherArgs(type);
    const leftType = leftSchema ? formatCompilerArgType(leftSchema) : args?.[0] ?? "Boolean";
    const rightType = rightSchema ? formatCompilerArgType(rightSchema) : args?.[1] ?? "Uint";
    return {
      is_left: obj.is_left,
      left: encodeCompactJsonValue(leftType, obj.left, leftSchema, env, `${at}.left`),
      right: encodeCompactJsonValue(rightType, obj.right, rightSchema, env, `${at}.right`),
    };
  }

  if (kind === "struct" || kind === "json") {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new Error(`${at}: expected JSON object for struct ${normalizeCompactType(type)}`);
    }
    const obj = json as Record<string, unknown>;
    const fields: Array<{ name: string; type: string; schema?: CompactTypeSchema }> = [];
    if (schema?.elements) {
      for (const el of schema.elements) {
        if (typeof el === "string") continue;
        fields.push({
          name: el.name,
          type: formatCompilerArgType(el.type),
          schema: el.type,
        });
      }
    } else {
      const decl = env?.structs?.find((s) => s.name === normalizeCompactType(type));
      if (decl) {
        for (const f of decl.fields) fields.push({ name: f.name, type: f.type });
      }
    }
    if (fields.length === 0) {
      // Pass through object as-is (best effort for named types without field info)
      return obj;
    }
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (!(f.name in obj)) throw new Error(`${at}: missing field "${f.name}"`);
      out[f.name] = encodeCompactJsonValue(
        f.type,
        obj[f.name],
        f.schema,
        env,
        `${at}.${f.name}`,
      );
    }
    return out;
  }

  throw new Error(`${at}: cannot encode type ${normalizeCompactType(type)}`);
}

/**
 * Parse a user form string into the JS value Compact-generated code expects.
 * Scalars: plain text. Composites: JSON.
 */
export function parseCompactValue(
  type: string,
  raw: string,
  schema?: CompactTypeSchema | null,
  env?: CompactTypeEnv,
): unknown {
  const kind = compactValueKind(type, schema, env);
  const value = raw.trim();
  if (!value) throw new Error(`Missing value for type ${normalizeCompactType(type)}`);

  if (kind === "unsupported") {
    throw new Error(
      `Type ${normalizeCompactType(type)} cannot be passed as a Compact circuit/constructor argument`,
    );
  }

  if (!isCompositeCompactKind(kind)) {
    return parseScalarString(type, value, schema);
  }

  // Enum may be entered as bare name/number without JSON quotes
  if (kind === "enum" && !value.startsWith("{") && !value.startsWith("[")) {
    const bare = value.replace(/^["']|["']$/g, "");
    return encodeCompactJsonValue(type, /^\d+$/.test(bare) ? Number(bare) : bare, schema, env);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      `Expected JSON for ${normalizeCompactType(type)}. Example:\n${exampleJsonForType(type, schema, env)}`,
    );
  }
  return encodeCompactJsonValue(type, parsed, schema, env);
}

export function validateCompactParams(
  specs: CompactParamSpec[],
  values: Record<string, string>,
  label = "Parameter",
  env?: CompactTypeEnv,
): string | null {
  if (specs.length === 0) return null;
  for (const spec of specs) {
    if (!isSupportedCompactType(spec.type, spec.typeSchema, env)) {
      return `${label} "${spec.name}": type ${normalizeCompactType(spec.type)} is not a valid Compact argument type`;
    }
  }
  const missing = specs.filter((s) => !(values[s.name] ?? "").trim());
  if (missing.length > 0) {
    return `Set ${label.toLowerCase()} value(s): ${missing.map((m) => m.name).join(", ")}`;
  }
  for (const spec of specs) {
    try {
      parseCompactValue(spec.type, values[spec.name] ?? "", spec.typeSchema, env);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `${label} "${spec.name}": ${msg}`;
    }
  }
  return null;
}

export function encodeCompactParams(
  specs: CompactParamSpec[],
  values: Record<string, string>,
  env?: CompactTypeEnv,
): unknown[] {
  const err = validateCompactParams(specs, values, "Parameter", env);
  if (err) throw new Error(err);
  return specs.map((spec) =>
    parseCompactValue(spec.type, values[spec.name] ?? "", spec.typeSchema, env),
  );
}

/** Map TypeScript `.d.ts` param types back to Compact-ish form types. */
export function mapTsTypeToCompact(tsType: string): string {
  const t = tsType.trim().replace(/\s+/g, " ");
  if (/^string$/i.test(t)) return 'Opaque<"string">';
  if (/^bigint$/i.test(t)) return "Uint";
  if (/^boolean$/i.test(t)) return "Boolean";
  if (/^Uint8Array$/i.test(t)) return "Bytes<32>";
  if (/\{\s*bytes\s*:\s*Uint8Array\s*\}/i.test(t)) return "ZswapCoinPublicKey";
  if (/EncodedCoinPublicKey/i.test(t)) return "ZswapCoinPublicKey";
  if (/ContractAddress/i.test(t)) return "ContractAddress";
  // bigint[] → Vector (length unknown from .d.ts alone)
  if (/^bigint\[\]$/.test(t)) return "Vector";
  // { is_some: boolean, value: … }
  if (/is_some\s*:\s*boolean/i.test(t) && /value\s*:/.test(t)) return "Maybe";
  if (/is_left\s*:\s*boolean/i.test(t)) return "Either";
  return t;
}

export function splitParamList(paramsStr: string): string[] {
  const out: string[] = [];
  let depthAngle = 0;
  let depthBrace = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let cur = "";
  for (let i = 0; i < paramsStr.length; i++) {
    const ch = paramsStr[i]!;
    if (ch === "<") depthAngle++;
    else if (ch === ">") depthAngle = Math.max(0, depthAngle - 1);
    else if (ch === "{") depthBrace++;
    else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === "(") depthParen++;
    else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
    else if (ch === "[") depthBracket++;
    else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
    else if (
      ch === "," &&
      depthAngle === 0 &&
      depthBrace === 0 &&
      depthParen === 0 &&
      depthBracket === 0
    ) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parseInitialStateParamsFromDts(dts: string): CompactParamSpec[] {
  const m = dts.match(/\binitialState\s*\(([^)]*)\)/);
  if (!m) return [];
  const parts = splitParamList(m[1] ?? "");
  if (parts.length <= 1) return [];
  return parts.slice(1).map((part) => {
    const idx = part.indexOf(":");
    const rawName = (idx >= 0 ? part.slice(0, idx) : part).trim();
    const tsType = (idx >= 0 ? part.slice(idx + 1) : "unknown").trim();
    const name = rawName.replace(/_\d+$/, "") || rawName;
    return { name, type: mapTsTypeToCompact(tsType) };
  });
}

/** Extract exported/local enum declarations from Compact source. */
export function extractEnumDecls(code: string): CompactEnumDecl[] {
  const out: CompactEnumDecl[] = [];
  const re = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const variants = m[2]!
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => v.split(/\s+/)[0]!)
      .filter(Boolean);
    out.push({ name: m[1]!, variants });
  }
  return out;
}

/** Extract struct declarations from Compact source. */
export function extractStructDecls(code: string): CompactStructDecl[] {
  const out: CompactStructDecl[] = [];
  const re = /(?:export\s+)?struct\s+(\w+)\s*(?:<[^>]*>)?\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const body = m[2]!;
    const fields: Array<{ name: string; type: string }> = [];
    for (const part of body.split(/[;,]/)) {
      const piece = part.trim();
      if (!piece) continue;
      const idx = piece.indexOf(":");
      if (idx < 0) continue;
      fields.push({
        name: piece.slice(0, idx).trim(),
        type: piece.slice(idx + 1).trim(),
      });
    }
    out.push({ name: m[1]!, fields });
  }
  return out;
}

export function typeEnvFromCompactSource(code: string): CompactTypeEnv {
  return {
    enums: extractEnumDecls(code),
    structs: extractStructDecls(code),
  };
}

export { toHex, fromHex };
