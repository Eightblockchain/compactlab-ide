import type * as Monaco from "monaco-editor";
import {
  ADT_METHODS,
  COMPACT_BUILTINS,
  COMPACT_KEYWORDS,
  COMPACT_TYPES,
  baseAdtName,
  extractAllSymbols,
  extractLedgerVars,
  hoverDocForWord,
  lookupSymbol,
  stdlibCompletions,
} from "@/lib/compact-symbols";
import { registerCompactLanguageService } from "@/lib/compact-lsp";

let compactLanguageRegistered = false;

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
    { token: "keyword",           foreground: "F06358", fontStyle: "bold" },
    { token: "keyword.pragma",    foreground: "F06358", fontStyle: "italic" },
    { token: "type",              foreground: "E8AA5B" },
    { token: "builtin",           foreground: "7EC8E3" },
    { token: "string",            foreground: "95CF98" },
    { token: "number",            foreground: "D4956A" },
    { token: "comment",           foreground: "5E6860", fontStyle: "italic" },
    { token: "identifier",        foreground: "E2E2E2" },
    { token: "identifier.ledger", foreground: "C9B8FF" },
    { token: "operator",          foreground: "AAAAAA" },
    { token: "delimiter.bracket", foreground: "888888" },
    { token: "delimiter",         foreground: "555555" },
    { token: "text",              foreground: "E2E2E2" },
    { token: "",                  foreground: "E2E2E2" },
  ];

  monaco.editor.defineTheme("compactlab-dark", {
    base: "vs-dark",
    inherit: true,
    rules: compactThemeRules,
    colors: {
      "editor.background":                       "#111111",
      "editor.foreground":                       "#E2E2E2",
      "editor.lineHighlightBackground":          "#1a1a1a",
      "editor.lineHighlightBorder":              "#00000000",
      "editor.selectionBackground":              "#F0635840",
      "editor.selectionHighlightBackground":     "#F0635820",
      "editor.inactiveSelectionBackground":      "#F0635825",
      "editor.wordHighlightBackground":          "#F0635818",
      "editor.wordHighlightStrongBackground":    "#F0635828",
      "editorLineNumber.foreground":             "#3a3a38",
      "editorLineNumber.activeForeground":       "#888884",
      "editorCursor.foreground":                 "#F06358",
      "editorCursor.background":                 "#111111",
      "editor.findMatchBackground":              "#F0635855",
      "editor.findMatchHighlightBackground":     "#F0635830",
      "editor.findMatchBorder":                  "#F06358",
      "editorGutter.background":                 "#111111",
      "editorIndentGuide.background1":           "#222220",
      "editorIndentGuide.activeBackground1":     "#444440",
      "editorBracketMatch.background":           "#F0635828",
      "editorBracketMatch.border":               "#F06358",
      "editorBracketHighlight.foreground1":      "#888888",
      "editorBracketHighlight.foreground2":      "#888888",
      "editorBracketHighlight.foreground3":      "#888888",
      "editorBracketHighlight.foreground4":      "#888888",
      "editorBracketHighlight.foreground5":      "#888888",
      "editorBracketHighlight.foreground6":      "#888888",
      "editorBracketHighlight.unexpectedBracket.foreground": "#F06358",
      "scrollbarSlider.background":              "#ffffff14",
      "scrollbarSlider.hoverBackground":         "#ffffff22",
      "scrollbarSlider.activeBackground":        "#ffffff30",
      "scrollbar.shadow":                        "#00000000",
      "editorWidget.background":                 "#191919",
      "editorWidget.foreground":                 "#E2E2E2",
      "editorWidget.border":                     "#333333",
      "editorWidget.resizeBorder":               "#F06358",
      "editorSuggestWidget.background":          "#191919",
      "editorSuggestWidget.border":              "#333333",
      "editorSuggestWidget.foreground":          "#E2E2E2",
      "editorSuggestWidget.selectedBackground":  "#F0635828",
      "editorSuggestWidget.selectedForeground":  "#F06358",
      "editorSuggestWidget.highlightForeground": "#F06358",
      "editorSuggestWidget.focusHighlightForeground": "#F5786D",
      "editorHoverWidget.background":            "#191919",
      "editorHoverWidget.foreground":            "#E2E2E2",
      "editorHoverWidget.border":                "#333333",
      "editorHoverWidget.statusBarBackground":   "#222222",
      "peekView.border":                         "#F06358",
      "peekViewTitle.background":                "#191919",
      "peekViewTitleLabel.foreground":           "#E8E8E8",
      "peekViewResult.background":               "#111111",
      "peekViewResult.selectionBackground":      "#F0635828",
      "peekViewEditor.background":               "#111111",
      "peekViewEditorGutter.background":         "#111111",
      "editorInlayHint.background":              "#191919",
      "editorInlayHint.foreground":              "#666360",
      "editorError.foreground":                  "#F06358",
      "editorWarning.foreground":                "#D4A853",
      "editorInfo.foreground":                   "#D4A853",
      "editorOverviewRuler.background":          "#111111",
      "editorOverviewRuler.border":              "#00000000",
      "editorOverviewRuler.errorForeground":     "#F06358",
      "editorOverviewRuler.warningForeground":   "#D4A853",
      "minimap.background":                      "#111111",
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
    triggerCharacters: [".", "<"],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const code = model.getValue();
      const linePrefix = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const suggestions: Monaco.languages.CompletionItem[] = [];

      // Dot completion: ledgerVar.method or Enum.Variant
      const dotMatch = linePrefix.match(/(\w+)\.(\w*)$/);
      if (dotMatch) {
        const base = dotMatch[1];
        const ledger = extractLedgerVars(code).find((v) => v.name === base);
        if (ledger?.type) {
          const adt = baseAdtName(ledger.type);
          if (adt && ADT_METHODS[adt]) {
            for (const m of ADT_METHODS[adt]) {
              suggestions.push({
                label: m.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: `${m.name}($0)`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: `${base}: ${ledger.type} · ${m.detail}`,
                documentation: `Method on ledger \`${base}\` (${ledger.type}).`,
                range,
              });
            }
          }
        }
        if (suggestions.length > 0) return { suggestions };
      }

      // File symbols: ledger, witness, circuits
      for (const sym of extractAllSymbols(code)) {
        const kind =
          sym.kind === "ledger"
            ? monaco.languages.CompletionItemKind.Field
            : sym.kind === "witness"
              ? monaco.languages.CompletionItemKind.Function
              : sym.kind === "circuit"
                ? monaco.languages.CompletionItemKind.Method
                : sym.kind === "enum-variant"
                  ? monaco.languages.CompletionItemKind.EnumMember
                  : monaco.languages.CompletionItemKind.Enum;
        const insertText =
          sym.kind === "witness" ? `${sym.name}()` : sym.name;
        suggestions.push({
          label: sym.name,
          kind,
          insertText,
          detail: sym.detail,
          documentation: sym.documentation,
          range,
          sortText: sym.kind === "ledger" ? `0_${sym.name}` : `1_${sym.name}`,
        });
      }

      // Stdlib
      for (const fn of stdlibCompletions()) {
        suggestions.push({
          label: fn.name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: fn.name === "pad" ? 'pad(${1:32}, "${2:domain}")' : `${fn.name}($0)`,
          insertTextRules:
            fn.name === "pad" || fn.name === "disclose"
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
          detail: fn.detail,
          documentation: fn.documentation,
          range,
        });
      }

      // Types
      for (const t of COMPACT_TYPES) {
        suggestions.push({
          label: t,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: ["Uint", "Bytes", "Vector", "Opaque"].includes(t)
            ? `${t}<${t === "Opaque" ? '"string"' : "32"}>`
            : t,
          insertTextRules: ["Uint", "Bytes", "Vector", "Opaque"].includes(t)
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          range,
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
            "\tconstructor() {",
            "\t}",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a new Compact contract",
          range,
        },
        {
          label: "circuit",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "export circuit ${1:circuitName}(${2:params}): ${3:[]} {",
            "\t$0",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define an exported circuit",
          range,
        },
        {
          label: "ledger",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "export ledger ${1:name}: ${2:Counter};",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a public ledger state variable",
          range,
        },
        {
          label: "witness",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "witness ${1:name}(): ${2:Bytes<32>};",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a private witness (function form)",
          range,
        },
        {
          label: "enum",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "enum ${1:State} {\n\t${2:Open},\n\t${3:Closed}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define an enum type",
          range,
        },
        {
          label: "pragma",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "pragma language_version >= 0.22;",
          documentation: "Language version pragma",
          range,
        },
        {
          label: "assert",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'assert ${1:condition}, "${2:error message}";',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Assert a condition with error message",
          range,
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
        },
        {
          label: "disclose",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "disclose(${1:value})",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Explicitly disclose witness-derived data",
          range,
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
      const doc = hoverDocForWord(code, word.word);
      const extra = lookupSymbol(code, word.word)?.line
        ? "\n\n_Go to definition (F12) · Find references (⇧F12)_"
        : "";
      if (!doc) {
        const line = model.getLineContent(position.lineNumber);
        const enumDot = line.slice(0, position.column - 1).match(/(\w+)\.(\w*)$/);
        if (enumDot) {
          const full = `${enumDot[1]}.${word.word}`;
          const fullDoc = hoverDocForWord(code, full);
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
