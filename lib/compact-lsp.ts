import type * as Monaco from "monaco-editor";
import {
  ADT_METHODS,
  COMPACT_BUILTINS,
  baseAdtName,
  extractAllSymbols,
  extractCircuits,
  extractLedgerVars,
  findIdentifierOccurrences,
  type CompactSymbol,
} from "@/lib/compact-symbols";

const BUILTIN_SIGNATURES: Record<string, { params: string[]; ret: string; docs: string }> = {
  disclose: {
    params: ["value: T"],
    ret: "T",
    docs: "Mark witness-derived data as intentionally public.",
  },
  persistentHash: {
    params: ["value: T"],
    ret: "Bytes<32>",
    docs: "SHA-256 hash suitable for persistent ledger state.",
  },
  persistentCommit: {
    params: ["value: T", "rand: Bytes<32>"],
    ret: "Bytes<32>",
    docs: "SHA-256 commitment with randomness.",
  },
  transientHash: {
    params: ["value: T"],
    ret: "Field",
    docs: "Circuit-optimized hash (not upgrade-stable).",
  },
  transientCommit: {
    params: ["value: T", "rand: Field"],
    ret: "Field",
    docs: "Circuit-efficient commitment (not upgrade-stable).",
  },
  pad: {
    params: ["n: Uint", "literal: string"],
    ret: "Bytes<n>",
    docs: "UTF-8-encode and zero-pad a string literal to n bytes. Literal must be ≤ n.",
  },
  ownPublicKey: {
    params: [],
    ret: "ZswapCoinPublicKey",
    docs: "Witness: caller coin public key. Do not use alone for auth.",
  },
  default: {
    params: [],
    ret: "T",
    docs: "Default value for a Compact type.",
  },
};

function toRange(monaco: typeof Monaco, line: number, column: number, endColumn: number) {
  return new monaco.Range(line, column, line, endColumn);
}

function definitionOf(monaco: typeof Monaco, uri: Monaco.Uri, sym: CompactSymbol) {
  if (!sym.line || !sym.column) return null;
  return {
    uri,
    range: toRange(monaco, sym.line, sym.column, sym.endColumn ?? sym.column + sym.name.length),
  };
}

function wordAt(model: Monaco.editor.ITextModel, position: Monaco.Position): string | null {
  return model.getWordAtPosition(position)?.word ?? null;
}

function lookup(code: string, name: string): CompactSymbol | undefined {
  return extractAllSymbols(code).find((s) => s.name === name);
}

export function registerCompactLanguageService(monaco: typeof Monaco) {
  monaco.languages.registerDefinitionProvider("compact", {
    provideDefinition: (model, position) => {
      const word = wordAt(model, position);
      if (!word) return null;
      const sym = lookup(model.getValue(), word);
      if (!sym) return null;
      return definitionOf(monaco, model.uri, sym);
    },
  });

  monaco.languages.registerReferenceProvider("compact", {
    provideReferences: (model, position) => {
      const word = wordAt(model, position);
      if (!word) return [];
      return findIdentifierOccurrences(model.getValue(), word).map((loc) => ({
        uri: model.uri,
        range: toRange(monaco, loc.line, loc.column, loc.endColumn),
      }));
    },
  });

  monaco.languages.registerDocumentHighlightProvider("compact", {
    provideDocumentHighlights: (model, position) => {
      const word = wordAt(model, position);
      if (!word) return [];
      return findIdentifierOccurrences(model.getValue(), word).map((loc) => ({
        range: toRange(monaco, loc.line, loc.column, loc.endColumn),
        kind: monaco.languages.DocumentHighlightKind.Text,
      }));
    },
  });

  monaco.languages.registerDocumentSymbolProvider("compact", {
    provideDocumentSymbols: (model) => {
      const code = model.getValue();
      return extractAllSymbols(code)
        .filter((s) => s.line && s.column)
        .map((s) => {
          const kind =
            s.kind === "ledger"
              ? monaco.languages.SymbolKind.Field
              : s.kind === "witness"
                ? monaco.languages.SymbolKind.Function
                : s.kind === "circuit"
                  ? monaco.languages.SymbolKind.Method
                  : s.kind === "enum"
                    ? monaco.languages.SymbolKind.Enum
                    : monaco.languages.SymbolKind.EnumMember;
          const range = toRange(monaco, s.line!, s.column!, s.endColumn ?? s.column! + s.name.length);
          return {
            name: s.name,
            detail: s.detail ?? s.kind,
            kind,
            tags: [],
            range,
            selectionRange: range,
            children: [],
          };
        });
    },
  });

  monaco.languages.registerRenameProvider("compact", {
    provideRenameEdits: (model, position, newName) => {
      const word = wordAt(model, position);
      if (!word || !/^[A-Za-z_][\w]*$/.test(newName)) return null;
      const edits = findIdentifierOccurrences(model.getValue(), word).map((loc) => ({
        resource: model.uri,
        versionId: undefined as number | undefined,
        textEdit: {
          range: toRange(monaco, loc.line, loc.column, loc.endColumn),
          text: newName,
        },
      }));
      return { edits };
    },
  });

  monaco.languages.registerSignatureHelpProvider("compact", {
    signatureHelpTriggerCharacters: ["(", ","],
    provideSignatureHelp: (model, position) => {
      const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const methodCall = line.match(/(\w+)\.([A-Za-z_]\w*)\s*\(([^()]*)$/);
      const call = methodCall ?? line.match(/([A-Za-z_]\w*)\s*\(([^()]*)$/);
      if (!call) return null;

      let name: string;
      let argIndex: number;
      let label = "";
      let docs = "";
      let params: string[] = [];
      const code = model.getValue();

      if (methodCall) {
        name = methodCall[2];
        argIndex = methodCall[3].split(",").length - 1;
        const ledger = extractLedgerVars(code).find((v) => v.name === methodCall[1]);
        const adt = ledger?.type ? baseAdtName(ledger.type) : null;
        const m = adt ? ADT_METHODS[adt]?.find((x) => x.name === name) : undefined;
        if (m) {
          const inner = m.detail.replace(/[()]/g, "").split("→")[0]?.trim() ?? "";
          params = inner ? inner.split(",").map((s) => s.trim()) : [];
          label = `${methodCall[1]}.${m.name}${m.detail}`;
          docs = `Method on ledger \`${methodCall[1]}\` (${ledger?.type}).`;
        }
      } else {
        name = call[1];
        argIndex = call[2].split(",").length - 1;
        const builtin = BUILTIN_SIGNATURES[name];
        if (builtin) {
          params = builtin.params;
          label = `${name}(${params.join(", ")}): ${builtin.ret}`;
          docs = builtin.docs;
        } else {
          const circuit = extractCircuits(code).find((c) => c.name === name);
          if (circuit) {
            params = (circuit.params ?? []).map((p) => `${p.name}: ${p.type}`);
            label = `${name}(${params.join(", ")}): ${circuit.type ?? "[]"}`;
            docs = circuit.documentation ?? "";
          }
        }
      }

      if (!label) return null;

      return {
        dispose: () => {},
        value: {
          activeSignature: 0,
          activeParameter: Math.max(0, Math.min(argIndex, Math.max(params.length - 1, 0))),
          signatures: [
            {
              label,
              documentation: docs,
              parameters: params.map((p) => ({ label: p })),
            },
          ],
        },
      };
    },
  });

  void COMPACT_BUILTINS;
}
