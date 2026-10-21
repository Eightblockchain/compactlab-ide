import type * as Monaco from "monaco-editor";
import {
  ADT_METHODS,
  COMPACT_BUILTINS,
  COMPACT_KEYWORDS,
  COMPACT_TYPES,
  baseAdtName,
  extractAllSymbols,
  extractEnums,
  extractLedgerVars,
  hoverDocForWord,
  lookupSymbol,
  scopedCompletions,
  stdlibCompletions,
  type CompactParam,
  type CompactSymbol,
} from "@/lib/compact-symbols";
import { extractStructDecls } from "@/lib/compact-values";
import { COMPACT_PRAGMA } from "@/lib/version";
import { registerCompactLanguageService } from "@/lib/compact-lsp";

let compactLanguageRegistered = false;

function circuitCallSnippet(
  name: string,
  params: CompactParam[] | undefined,
): { insertText: string; asSnippet: boolean } {
  if (!params?.length) return { insertText: `${name}()`, asSnippet: false };
  const args = params.map((p, i) => `\${${i + 1}:${p.name}}`).join(", ");
  return { insertText: `${name}(${args})`, asSnippet: true };
}

function symbolKind(
  monaco: typeof Monaco,
  kind: CompactSymbol["kind"],
): Monaco.languages.CompletionItemKind {
  switch (kind) {
    case "ledger":
      return monaco.languages.CompletionItemKind.Field;
    case "witness":
      return monaco.languages.CompletionItemKind.Function;
    case "circuit":
      return monaco.languages.CompletionItemKind.Method;
    case "enum":
      return monaco.languages.CompletionItemKind.Enum;
    case "enum-variant":
      return monaco.languages.CompletionItemKind.EnumMember;
    case "param":
      return monaco.languages.CompletionItemKind.Variable;
    case "local":
      return monaco.languages.CompletionItemKind.Variable;
    case "struct":
    case "type":
      return monaco.languages.CompletionItemKind.Class;
    case "stdlib":
      return monaco.languages.CompletionItemKind.Function;
    default:
      return monaco.languages.CompletionItemKind.Text;
  }
}

export function registerCompactLanguage(monaco: typeof Monaco) {
  if (compactLanguageRegistered) return;
  compactLanguageRegistered = true;

  monaco.languages.register({ id: "compact" });

  monaco.languages.setMonarchTokensProvider("compact", {
    defaultToken: "text",
    tokenPostfix: ".compact",

    keywords: [...COMPACT_KEYWORDS],
    types: [...COMPACT_TYPES],
    builtins: [...COMPACT_BUILTINS],

    operators: [
      "=", ">", "<", "!", "~", "?", ":",
      "==", "<=", ">=", "!=", "&&", "||", "++", "--",
      "+", "-", "*", "/", "&", "|", "^", "%", "<<", ">>",
      "+=", "-=", "*=", "/=", "&=", "|=", "^=", "%=", "<<=", ">>=",
    ],

    tokenizer: {
      root: [
        [/pragma\b/, "keyword.pragma"],
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],
        [/\d+/, "number"],
        [/[a-zA-Z_][\w]*/, {
          cases: {
            "@keywords": "keyword",
            "@types": "type",
            "@builtins": "builtin",
            "@default": "identifier",
          },
        }],
        [/<\d+>/, "number"],
        [/[{}[\]()]/, "delimiter.bracket"],
        [/[=<>!+\-*&|^%?:/~]/, "operator"],
        [/;/, "delimiter"],
        [/\s+/, "white"],
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  } as Monaco.languages.IMonarchLanguage);

  const compactThemeRules: Monaco.editor.ITokenThemeRule[] = [
    { token: "keyword",           foreground: "F07A70" },
    { token: "keyword.pragma",    foreground: "F07A70", fontStyle: "italic" },
    { token: "type",              foreground: "E5B567" },
    { token: "builtin",           foreground: "7DC4E4" },
    { token: "string",            foreground: "A3D49B" },
    { token: "number",            foreground: "E8A07A" },
    { token: "comment",           foreground: "5B5B66", fontStyle: "italic" },
    { token: "identifier",        foreground: "DCDCE0" },
    { token: "identifier.ledger", foreground: "C4B5FD" },
    { token: "operator",          foreground: "9A9AA3" },
    { token: "delimiter.bracket", foreground: "8A8A94" },
    { token: "delimiter",         foreground: "5B5B66" },
    { token: "text",              foreground: "DCDCE0" },
    { token: "",                  foreground: "DCDCE0" },
  ];

  monaco.editor.defineTheme("compactlab-dark", {
    base: "vs-dark",
    inherit: true,
    rules: compactThemeRules,
    colors: {
      "editor.background":                       "#0c0c0e",
      "editor.foreground":                       "#DCDCE0",
      "editor.lineHighlightBackground":          "#ffffff06",
      "editor.lineHighlightBorder":              "#00000000",
      "editor.selectionBackground":              "#F0635840",
      "editor.selectionHighlightBackground":     "#F0635820",
      "editor.inactiveSelectionBackground":      "#F0635825",
      "editor.wordHighlightBackground":          "#F0635818",
      "editor.wordHighlightStrongBackground":    "#F0635828",
      "editorLineNumber.foreground":             "#3f3f46",
      "editorLineNumber.activeForeground":       "#a1a1aa",
      "editorCursor.foreground":                 "#F06358",
      "editorCursor.background":                 "#0c0c0e",
      "editor.findMatchBackground":              "#F0635855",
      "editor.findMatchHighlightBackground":     "#F0635830",
      "editor.findMatchBorder":                  "#F06358",
      "editorGutter.background":                 "#0c0c0e",
      "editorIndentGuide.background1":           "#1c1c20",
      "editorIndentGuide.activeBackground1":     "#34343a",
      "editorBracketMatch.background":           "#F0635828",
      "editorBracketMatch.border":               "#F06358",
      "editorBracketHighlight.foreground1":      "#8a8a94",
      "editorBracketHighlight.foreground2":      "#8a8a94",
      "editorBracketHighlight.foreground3":      "#8a8a94",
      "editorBracketHighlight.foreground4":      "#8a8a94",
      "editorBracketHighlight.foreground5":      "#8a8a94",
      "editorBracketHighlight.foreground6":      "#8a8a94",
      "editorBracketHighlight.unexpectedBracket.foreground": "#F06358",
      "scrollbarSlider.background":              "#ffffff14",
      "scrollbarSlider.hoverBackground":         "#ffffff22",
      "scrollbarSlider.activeBackground":        "#ffffff30",
      "scrollbar.shadow":                        "#00000000",
      "editorWidget.background":                 "#151518",
      "editorWidget.foreground":                 "#DCDCE0",
      "editorWidget.border":                     "#ffffff14",
      "editorWidget.resizeBorder":               "#F06358",
      "editorSuggestWidget.background":          "#151518",
      "editorSuggestWidget.border":              "#ffffff14",
      "editorSuggestWidget.foreground":          "#DCDCE0",
      "editorSuggestWidget.selectedBackground":  "#F0635828",
      "editorSuggestWidget.selectedForeground":  "#F06358",
      "editorSuggestWidget.highlightForeground": "#F06358",
      "editorSuggestWidget.focusHighlightForeground": "#F5786D",
      "editorHoverWidget.background":            "#151518",
      "editorHoverWidget.foreground":            "#DCDCE0",
      "editorHoverWidget.border":                "#ffffff14",
      "editorHoverWidget.statusBarBackground":   "#222222",
      "peekView.border":                         "#F06358",
      "peekViewTitle.background":                "#151518",
      "peekViewTitleLabel.foreground":           "#E8E8E8",
      "peekViewResult.background":               "#0c0c0e",
      "peekViewResult.selectionBackground":      "#F0635828",
      "peekViewEditor.background":               "#0c0c0e",
      "peekViewEditorGutter.background":         "#0c0c0e",
      "editorInlayHint.background":              "#151518",
      "editorInlayHint.foreground":              "#666360",
      "editorError.foreground":                  "#F06358",
      "editorWarning.foreground":                "#D4A853",
      "editorInfo.foreground":                   "#D4A853",
      "editorOverviewRuler.background":          "#0c0c0e",
      "editorOverviewRuler.border":              "#00000000",
      "editorOverviewRuler.errorForeground":     "#F06358",
      "editorOverviewRuler.warningForeground":   "#D4A853",
      "minimap.background":                      "#0c0c0e",
    },
  });

  monaco.languages.setLanguageConfiguration("compact", {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [["{", "}"], ["[", "]"], ["(", ")"], ["<", ">"]],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "<", close: ">" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "<", close: ">" },
      { open: '"', close: '"' },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*\{[^}]*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
  });

  monaco.languages.registerCompletionItemProvider("compact", {
    triggerCharacters: [".", "<", ":", "("],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const code = model.getValue();
      const offset = model.getOffsetAt(position);
      const linePrefix = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const suggestions: Monaco.languages.CompletionItem[] = [];
      const seen = new Set<string>();
      const labelText = (label: Monaco.languages.CompletionItem["label"]): string => {
        if (typeof label === "string") return label;
        return label.label;
      };
      const pushUnique = (item: Monaco.languages.CompletionItem) => {
        const key = labelText(item.label);
        if (!key || seen.has(key)) return;
        seen.add(key);
        suggestions.push(item);
      };

      const inTypePosition = /(?::|ledger\s+\w+\s*:|witness\s+\w+\s*\([^)]*\)\s*:|->)\s*[\w<]*$/.test(
        linePrefix,
      );

      // Dot completion: ledgerVar.method or Enum.Variant
      const dotMatch = linePrefix.match(/(\w+)\.(\w*)$/);
      if (dotMatch) {
        const base = dotMatch[1]!;

        const ledger = extractLedgerVars(code).find((v) => v.name === base);
        if (ledger?.type) {
          const adt = baseAdtName(ledger.type);
          if (adt && ADT_METHODS[adt]) {
            for (const m of ADT_METHODS[adt]) {
              pushUnique({
                label: m.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: `${m.name}($0)`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: `${base}: ${ledger.type} · ${m.detail}`,
                documentation: `Method on ledger \`${base}\` (${ledger.type}).`,
                range,
                sortText: `0_${m.name}`,
              });
            }
          }
        }

        const enumSym = extractEnums(code).find(
          (s) => s.kind === "enum" && s.name === base,
        );
        if (enumSym) {
          for (const variant of extractEnums(code).filter(
            (s) => s.kind === "enum-variant" && s.name.startsWith(`${base}.`),
          )) {
            const short = variant.name.slice(base.length + 1);
            pushUnique({
              label: short,
              kind: monaco.languages.CompletionItemKind.EnumMember,
              insertText: short,
              detail: variant.detail,
              documentation: variant.documentation,
              range,
              sortText: `0_${short}`,
            });
          }
        }

        if (suggestions.length > 0) return { suggestions };
      }

      // Inside a circuit / constructor: params + locals first
      for (const sym of scopedCompletions(code, offset)) {
        pushUnique({
          label: {
            label: sym.name,
            description: sym.kind === "param" ? "param" : "local",
          },
          kind: symbolKind(monaco, sym.kind),
          insertText: sym.name,
          detail: sym.detail,
          documentation: sym.documentation,
          range,
          sortText: `0_${sym.name}`,
        });
      }

      // File symbols: ledger, witness, circuits, enums
      for (const sym of extractAllSymbols(code)) {
        if (sym.kind === "enum-variant") {
          // Prefer Enum.Variant via dot completion; still offer full name.
          pushUnique({
            label: sym.name,
            kind: symbolKind(monaco, sym.kind),
            insertText: sym.name,
            detail: sym.detail,
            documentation: sym.documentation,
            range,
            sortText: `3_${sym.name}`,
          });
          continue;
        }

        if (sym.kind === "circuit") {
          const { insertText, asSnippet } = circuitCallSnippet(sym.name, sym.params);
          pushUnique({
            label: {
              label: sym.name,
              description: sym.detail,
            },
            kind: symbolKind(monaco, sym.kind),
            insertText,
            insertTextRules: asSnippet
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            detail: sym.detail,
            documentation: sym.documentation,
            range,
            sortText: `1_${sym.name}`,
          });
          continue;
        }

        const insertText =
          sym.kind === "witness" ? `${sym.name}()` : sym.name;
        pushUnique({
          label: sym.name,
          kind: symbolKind(monaco, sym.kind),
          insertText,
          detail: sym.detail,
          documentation: sym.documentation,
          range,
          sortText:
            sym.kind === "ledger"
              ? `1_${sym.name}`
              : sym.kind === "witness"
                ? `1_${sym.name}`
                : `2_${sym.name}`,
        });
      }

      // User-defined structs as types
      for (const st of extractStructDecls(code)) {
        pushUnique({
          label: st.name,
          kind: monaco.languages.CompletionItemKind.Struct,
          insertText: st.name,
          detail: `struct · ${st.fields.map((f) => f.name).join(", ") || "empty"}`,
          documentation: `Struct \`${st.name}\`${
            st.fields.length
              ? ` with fields: ${st.fields.map((f) => `${f.name}: ${f.type}`).join(", ")}`
              : ""
          }.`,
          range,
          sortText: inTypePosition ? `0_${st.name}` : `2_${st.name}`,
        });
      }

      // Stdlib
      for (const fn of stdlibCompletions()) {
        pushUnique({
          label: fn.name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText:
            fn.name === "pad"
              ? 'pad(${1:32}, "${2:domain}")'
              : fn.name === "ownPublicKey" || fn.name === "default"
                ? `${fn.name}()`
                : `${fn.name}($0)`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: fn.detail,
          documentation: fn.documentation,
          range,
          sortText: `2_${fn.name}`,
        });
      }

      // Built-in + user-facing Compact types
      for (const t of COMPACT_TYPES) {
        const needsArg = ["Uint", "Bytes", "Vector", "Opaque", "Set", "Map", "List", "Maybe", "Either"].includes(t);
        let insertText: string = t;
        if (t === "Opaque") insertText = 'Opaque<"${1:string}">';
        else if (t === "Uint" || t === "Bytes") insertText = `${t}<\${1:32}>`;
        else if (t === "Vector") insertText = "Vector<${1:2}, ${2:Bytes<32>}>";
        else if (t === "Set") insertText = "Set<${1:Bytes<32>}>";
        else if (t === "Map") insertText = "Map<${1:Bytes<32>}, ${2:Uint<64>}>";
        else if (t === "List") insertText = "List<${1:Bytes<32>}>";
        else if (t === "Maybe") insertText = "Maybe<${1:Bytes<32>}>";
        else if (t === "Either") insertText = "Either<${1:Boolean}, ${2:Bytes<32>}>";

        pushUnique({
          label: t,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText,
          insertTextRules: needsArg
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          detail: "Compact type",
          range,
          sortText: inTypePosition ? `0_${t}` : `4_${t}`,
        });
      }

      // Keywords as snippets
      suggestions.push(
        {
          label: "contract",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "contract ${1:ContractName} {",
            "\t$0",
            "\tconstructor(${2}) {",
            "\t}",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a new Compact contract",
          range,
          sortText: "5_contract",
        },
        {
          label: "circuit",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "export circuit ${1:circuitName}(${2:param}: ${3:Bytes<32>}): ${4:[]} {",
            "\t$0",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define an exported circuit",
          range,
          sortText: "5_circuit",
        },
        {
          label: "constructor",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "constructor(${1:param}: ${2:Bytes<32>}) {",
            "\t$0",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Contract constructor (runs once at Deploy)",
          range,
          sortText: "5_constructor",
        },
        {
          label: "ledger",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "export ledger ${1:name}: ${2:Counter};",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a public ledger state variable",
          range,
          sortText: "5_ledger",
        },
        {
          label: "witness",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "witness ${1:name}(): ${2:Bytes<32>};",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a private witness (function form)",
          range,
          sortText: "5_witness",
        },
        {
          label: "enum",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "enum ${1:State} {\n\t${2:Open},\n\t${3:Closed}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define an enum type",
          range,
          sortText: "5_enum",
        },
        {
          label: "struct",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "struct ${1:Name} {\n\t${2:field}: ${3:Bytes<32>};\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a struct type",
          range,
          sortText: "5_struct",
        },
        {
          label: "pragma",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: COMPACT_PRAGMA,
          documentation: "Language version pragma",
          range,
          sortText: "5_pragma",
        },
        {
          label: "assert",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'assert ${1:condition}, "${2:error message}";',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Assert a condition with error message",
          range,
          sortText: "5_assert",
        },
        {
          label: "nullifier pattern",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "circuit nullifierFor(sk: Bytes<32>): Bytes<32> {",
            "\treturn persistentHash<Vector<2, Bytes<32>>>([",
            '\t\tpad(32, "${1:myapp:nullifier:v1}"),',
            "\t\tsk",
            "\t]);",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Domain-separated nullifier hash (keep pad string ≤ 32 bytes)",
          range,
          sortText: "5_nullifier",
        },
        {
          label: "disclose",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "disclose(${1:value})",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Explicitly disclose witness-derived data",
          range,
          sortText: "5_disclose",
        },
      );

      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider("compact", {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const code = model.getValue();
      const offset = model.getOffsetAt(position);
      const doc = hoverDocForWord(code, word.word, offset);
      const extra = lookupSymbol(code, word.word)?.line
        ? "\n\n_Go to definition (F12) · Find references (⇧F12)_"
        : "";
      if (!doc) {
        const line = model.getLineContent(position.lineNumber);
        const enumDot = line.slice(0, position.column - 1).match(/(\w+)\.(\w*)$/);
        if (enumDot) {
          const full = `${enumDot[1]}.${word.word}`;
          const fullDoc = hoverDocForWord(code, full, offset);
          if (fullDoc) {
            return {
              range: new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn,
              ),
              contents: [{ value: fullDoc }],
            };
          }
        }
        return null;
      }

      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        ),
        contents: [{ value: doc + extra }],
      };
    },
  });

  registerCompactLanguageService(monaco);
}
