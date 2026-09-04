/** Symbol extraction and stdlib metadata for Compact editor intelligence. */

export interface CompactLocation {
  line: number;
  column: number;
  endColumn: number;
}

export interface CompactParam {
  name: string;
  type: string;
}

export interface CompactSymbol {
  name: string;
  kind: "ledger" | "witness" | "circuit" | "enum" | "enum-variant" | "stdlib" | "keyword" | "type";
  type?: string;
  detail?: string;
  documentation?: string;
  isExported?: boolean;
  line?: number;
  column?: number;
  endColumn?: number;
  params?: CompactParam[];
}

export function indexToLineCol(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

export function locForName(code: string, matchIndex: number, name: string): CompactLocation {
  const rel = code.slice(matchIndex).indexOf(name);
  const abs = matchIndex + (rel >= 0 ? rel : 0);
  const { line, column } = indexToLineCol(code, abs);
  return { line, column, endColumn: column + name.length };
}

import { splitParamList } from "./compact-values";

export function parseParamList(paramsStr: string): CompactParam[] {
  if (!paramsStr.trim()) return [];
  return splitParamList(paramsStr)
    .map((p) => {
      const idx = p.indexOf(":");
      if (idx < 0) return { name: p.trim(), type: "Uint<32>" };
      return { name: p.slice(0, idx).trim(), type: p.slice(idx + 1).trim() };
    })
    .filter((p) => p.name);
}

/** Skip strings/comments; collect identifier occurrences of `name`. */
export function findIdentifierOccurrences(code: string, name: string): CompactLocation[] {
  const out: CompactLocation[] = [];
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  const masked = maskStringsAndComments(code);
  let match: RegExpExecArray | null;
  while ((match = re.exec(masked)) !== null) {
    const { line, column } = indexToLineCol(code, match.index);
    out.push({ line, column, endColumn: column + name.length });
  }
  return out;
}

export function maskStringsAndComments(code: string): string {
  let out = "";
  let i = 0;
  while (i < code.length) {
    if (code[i] === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (code[i] === "/" && code[i + 1] === "*") {
      out += "  ";
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
        out += code[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < code.length) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (code[i] === '"') {
      out += " ";
      i++;
      while (i < code.length && code[i] !== '"') {
        if (code[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += code[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < code.length) {
        out += " ";
        i++;
      }
      continue;
    }
    out += code[i];
    i++;
  }
  return out;
}

export interface CircuitBody {
  name: string;
  params: CompactParam[];
  output: string;
  body: string;
  bodyStartLine: number;
  bodyStartIndex: number;
  isExported: boolean;
  isConstructor: boolean;
}

export function extractCircuitBodies(code: string): CircuitBody[] {
  const bodies: CircuitBody[] = [];
  const re = /(?:(export)\s+)?(circuit|constructor)\s*(\w+)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const kind = match[2];
    const name = kind === "constructor" ? "constructor" : (match[3] ?? "");
    if (!name) continue;
    let i = match.index + match[0].length;
    while (i < code.length && /\s/.test(code[i]!)) i++;
    if (code[i] !== "{") continue;
    const open = i;
    let depth = 0;
    for (; i < code.length; i++) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") {
        depth--;
        if (depth === 0) {
          const inner = code.slice(open + 1, i);
          bodies.push({
            name,
            params: parseParamList(match[4] ?? ""),
            output: (match[5] ?? "[]").trim(),
            body: inner,
            bodyStartLine: indexToLineCol(code, open + 1).line,
            bodyStartIndex: open + 1,
            isExported: Boolean(match[1]),
            isConstructor: kind === "constructor",
          });
          break;
        }
      }
    }
  }
  return bodies;
}

export const COMPACT_KEYWORDS = [
  "pragma",
  "import",
  "contract",
  "circuit",
  "export",
  "ledger",
  "witness",
  "constructor",
  "return",
  "if",
  "else",
  "while",
  "for",
  "const",
  "let",
  "assert",
  "hash",
  "true",
  "false",
  "disclose",
  "sealed",
  "enum",
  "default",
] as const;

export const COMPACT_TYPES = [
  "Uint",
  "Boolean",
  "Bytes",
  "Field",
  "PublicKey",
  "Signature",
  "CellPath",
  "ZSwapMerkleTree",
  "CompactStandardLibrary",
  "Counter",
  "Set",
  "Map",
  "List",
  "Opaque",
  "Vector",
  "HistoricMerkleTree",
  "MerkleTreePath",
  "ZswapCoinPublicKey",
] as const;

export const COMPACT_BUILTINS = [
  "disclose",
  "persistentHash",
  "persistentCommit",
  "transientHash",
  "transientCommit",
  "pad",
  "ownPublicKey",
  "default",
] as const;

/** Methods available on ledger ADTs (prefix match on base type name). */
export const ADT_METHODS: Record<string, { name: string; detail: string }[]> = {
  Counter: [
    { name: "increment", detail: "(amount: Uint<16>)" },
    { name: "decrement", detail: "(amount: Uint<16>)" },
    { name: "read", detail: "() → Uint<64>" },
    { name: "lessThan", detail: "(n: Uint<64>)" },
    { name: "resetToDefault", detail: "()" },
  ],
  Set: [
    { name: "insert", detail: "(value: T)" },
    { name: "remove", detail: "(value: T)" },
    { name: "member", detail: "(value: T)" },
    { name: "size", detail: "() → Uint<64>" },
    { name: "isEmpty", detail: "() → Boolean" },
  ],
  Map: [
    { name: "insert", detail: "(key: K, value: V)" },
    { name: "lookup", detail: "(key: K)" },
    { name: "member", detail: "(key: K)" },
    { name: "remove", detail: "(key: K)" },
    { name: "size", detail: "() → Uint<64>" },
    { name: "isEmpty", detail: "() → Boolean" },
  ],
  List: [
    { name: "pushFront", detail: "(value: T)" },
    { name: "pushBack", detail: "(value: T)" },
    { name: "popFront", detail: "()" },
    { name: "popBack", detail: "()" },
    { name: "size", detail: "() → Uint<64>" },
    { name: "isEmpty", detail: "() → Boolean" },
  ],
};

const BUILTIN_DOCS: Record<string, string> = {
  disclose:
    "Declare intentional disclosure of witness-derived data to the public ledger or circuit return.",
  persistentHash: "SHA-256 hash suitable for persistent state (Bytes<32>).",
  persistentCommit: "SHA-256 commitment with randomness (Bytes<32>).",
  transientHash: "Circuit-optimized hash; not guaranteed across protocol upgrades.",
  transientCommit: "Circuit-efficient commitment; not guaranteed across upgrades.",
  pad: "UTF-8-encode a string literal and zero-pad to exactly N bytes. String must be ≤ N bytes.",
  ownPublicKey: "Witness: Zswap coin public key of the caller. Do not use alone for auth.",
  default: "Default value for a Compact type.",
};

const KEYWORD_DOCS: Record<string, string> = {
  ledger: "Public on-chain state. Visible to all observers.",
  witness: "Private off-chain input. Implementation runs in the DApp frontend.",
  circuit: "On-chain computation validated by a zero-knowledge proof.",
  contract: "Top-level smart contract definition.",
  assert: "Enforce a constraint; failure rejects the transaction.",
  pragma: "Compiler directive (language version).",
  export: "Make a circuit callable from outside the contract.",
  sealed: "Ledger field immutable after constructor initialization.",
  enum: "Algebraic enum type with variants.",
  disclose: BUILTIN_DOCS.disclose,
  constructor: "Runs once at contract deployment.",
  import: "Import the Compact standard library or modules.",
};

export function extractLedgerVars(code: string): CompactSymbol[] {
  const vars: CompactSymbol[] = [];
  const re = /(?:export\s+)?(?:sealed\s+)?ledger\s+(\w+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const type = match[2].trim();
    const loc = locForName(code, match.index, match[1]);
    vars.push({
      name: match[1],
      kind: "ledger",
      type,
      detail: `ledger ${type}`,
      documentation: `Public ledger field \`${match[1]}\` (${type}). Stored on-chain.`,
      ...loc,
    });
  }
  return vars;
}

export function extractWitnesses(code: string): CompactSymbol[] {
  const witnesses: CompactSymbol[] = [];
  const re = /witness\s+(\w+)\s*\([^)]*\)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const type = match[2].trim();
    const loc = locForName(code, match.index, match[1]);
    witnesses.push({
      name: match[1],
      kind: "witness",
      type,
      detail: `witness → ${type}`,
      documentation: `Private witness \`${match[1]}()\`. Implemented in TypeScript; never sent to chain raw.`,
      ...loc,
    });
  }
  return witnesses;
}

export function extractCircuits(code: string): CompactSymbol[] {
  const circuits: CompactSymbol[] = [];
  const re = /(?:(export)\s+)?circuit\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^{]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const exported = Boolean(match[1]);
    const params = parseParamList(match[3]);
    const output = match[4].trim();
    const loc = locForName(code, match.index, match[2]);
    circuits.push({
      name: match[2],
      kind: "circuit",
      type: output,
      isExported: exported,
      params,
      detail: params.length ? `(${match[3].trim()}) → ${output}` : `() → ${output}`,
      documentation: `Circuit \`${match[2]}\`. ${exported ? "Exported (callable)." : "Internal helper."}`,
      ...loc,
    });
  }
  return circuits;
}

export function extractEnums(code: string): CompactSymbol[] {
  const symbols: CompactSymbol[] = [];
  const enumRe = /enum\s+(\w+)\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = enumRe.exec(code)) !== null) {
    const enumName = match[1];
    const loc = locForName(code, match.index, enumName);
    symbols.push({
      name: enumName,
      kind: "enum",
      detail: "enum",
      documentation: `Enum type \`${enumName}\`.`,
      ...loc,
    });
    const variants = match[2].split(",").map((v) => v.trim()).filter(Boolean);
    for (const variant of variants) {
      symbols.push({
        name: `${enumName}.${variant}`,
        kind: "enum-variant",
        detail: `${enumName}.${variant}`,
        documentation: `Variant \`${variant}\` of enum \`${enumName}\`.`,
      });
    }
  }
  return symbols;
}

export function extractAllSymbols(code: string): CompactSymbol[] {
  return [
    ...extractLedgerVars(code),
    ...extractWitnesses(code),
    ...extractCircuits(code),
    ...extractEnums(code),
  ];
}

export function lookupSymbol(code: string, name: string): CompactSymbol | undefined {
  return extractAllSymbols(code).find((s) => s.name === name);
}

/** Base ADT name from types like `Set<Bytes<32>>` or `Counter`. */
export function baseAdtName(type: string): string | null {
  const m = type.trim().match(/^(\w+)/);
  if (!m) return null;
  return ADT_METHODS[m[1]] ? m[1] : null;
}

export function hoverDocForWord(code: string, word: string): string | null {
  if (KEYWORD_DOCS[word]) return KEYWORD_DOCS[word];
  if (BUILTIN_DOCS[word]) return BUILTIN_DOCS[word];

  const sym = lookupSymbol(code, word);
  if (sym?.documentation) return sym.documentation;

  if (word.includes(".")) {
    const enumSym = extractEnums(code).find((s) => s.name === word);
    if (enumSym?.documentation) return enumSym.documentation;
  }

  const typeDoc: Record<string, string> = {
    Uint: "Unsigned integer Uint<N>. Common sizes: 8, 16, 32, 64, 128.",
    Boolean: "Boolean true/false.",
    Bytes: "Fixed-length byte array Bytes<N>.",
    Field: "Field element for arithmetic in circuits.",
    Counter: "Ledger ADT: monotonic counter with increment/decrement.",
    Set: "Ledger ADT: set of unique values.",
    Map: "Ledger ADT: key-value map.",
    List: "Ledger ADT: doubly-linked list.",
    Opaque: "Opaque foreign value (string or Uint8Array tag).",
    Vector: "Fixed-size vector type Vector<N, T>.",
  };
  return typeDoc[word] ?? null;
}

export function stdlibCompletions(): CompactSymbol[] {
  return COMPACT_BUILTINS.map((name) => ({
    name,
    kind: "stdlib" as const,
    detail: "stdlib",
    documentation: BUILTIN_DOCS[name],
  }));
}
