import type * as Monaco from "monaco-editor";

export function registerCompactLanguage(monaco: typeof Monaco) {
  // Register language
  monaco.languages.register({ id: "compact" });

  // Syntax tokenizer
  monaco.languages.setMonarchTokensProvider("compact", {
    defaultToken: "text",
    tokenPostfix: ".compact",

    keywords: [
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
    ],

    types: [
      "Uint",
      "Boolean",
      "Bytes",
      "Field",
      "PublicKey",
      "Signature",
      "CellPath",
      "ZSwapMerkleTree",
      "CompactStandardLibrary",
    ],

    operators: [
      "=", ">", "<", "!", "~", "?", ":",
      "==", "<=", ">=", "!=", "&&", "||", "++", "--",
      "+", "-", "*", "/", "&", "|", "^", "%", "<<", ">>",
      "+=", "-=", "*=", "/=", "&=", "|=", "^=", "%=", "<<=", ">>=",
    ],

    tokenizer: {
      root: [
        // Pragmas
        [/pragma\b/, "keyword.pragma"],

        // Comments
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],

        // Strings
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],

        // Numbers
        [/\d+/, "number"],

        // Keywords, types, identifiers
        [/[a-zA-Z_][\w]*/, {
          cases: {
            "@keywords": "keyword",
            "@types": "type",
            "@default": "identifier",
          },
        }],

        // Angle brackets for generics like Uint<32>
        [/<\d+>/, "number"],

        // Brackets
        [/[{}[\]()]/, "delimiter.bracket"],

        // Operators
        [/[=<>!+\-*&|^%?:/~]/, "operator"],

        // Semicolons
        [/;/, "delimiter"],

        // Whitespace
        [/\s+/, "white"],
      ],

      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  } as Monaco.languages.IMonarchLanguage);

  // ─── CompactLab Dark syntax tokens ─────────────────────────────────────────
  // Editor bg: #111111 — deep dark, crisp text contrast.
  // Color roles (all warm-neutral, no blue, no purple, no muddy brown):
  //   keywords    #F06358  brand coral-red, bold — contract / circuit / ledger
  //   types       #E8AA5B  warm amber — Uint / Boolean / Bytes / Field
  //   strings     #95CF98  soft sage-green — string literals
  //   numbers     #D4956A  warm terracotta — numeric values
  //   comments    #666360  warm-grey italic, ~3.3:1 contrast — readable but recedes
  //   identifiers #E8E8E8  near-white — variable/function names, dominant
  //   operators   #C8C8BE  warm light-grey — punctuation, neutral
  //   brackets    #C8C8BE  same — no rainbow coloring
  //   delimiters  #666360  same as comments — receded semicolons/colons
  // ────────────────────────────────────────────────────────────────────────────
  const compactThemeRules: Monaco.editor.ITokenThemeRule[] = [
    { token: "keyword",           foreground: "F06358", fontStyle: "bold" },
    { token: "keyword.pragma",    foreground: "F06358", fontStyle: "italic" },
    { token: "type",              foreground: "E8AA5B" },
    { token: "string",            foreground: "95CF98" },
    { token: "number",            foreground: "D4956A" },
    { token: "comment",           foreground: "5E6860", fontStyle: "italic" },
    { token: "identifier",        foreground: "E2E2E2" },
    { token: "operator",          foreground: "AAAAAA" },
    { token: "delimiter.bracket", foreground: "888888" },
    { token: "delimiter",         foreground: "555555" },
    { token: "text",              foreground: "E2E2E2" },
    { token: "",                  foreground: "E2E2E2" },
  ];

  // ─── Monaco editor theme ─────────────────────────────────────────────────
  // Deep dark: #111111 editor sits slightly above #0d0d0d shell.
  // All widgetbackgrounds match the shell (#0d0d0d / #111111).
  // Selection and highlights use the F06358 brand coral.
  // No blues or purples anywhere — every color is warm or neutral grey.
  // ─────────────────────────────────────────────────────────────────────────
  monaco.editor.defineTheme("compactlab-dark", {
    base: "vs-dark",
    inherit: true,
    rules: compactThemeRules,
    colors: {
      // Core
      "editor.background":                       "#111111",
      "editor.foreground":                       "#E2E2E2",
      // Active line — very subtle lift, not distracting
      "editor.lineHighlightBackground":          "#1a1a1a",
      "editor.lineHighlightBorder":              "#00000000",
      // Selection — brand coral tint
      "editor.selectionBackground":              "#F0635840",
      "editor.selectionHighlightBackground":     "#F0635820",
      "editor.inactiveSelectionBackground":      "#F0635825",
      // Occurrence highlights (double-click word)
      "editor.wordHighlightBackground":          "#F0635818",
      "editor.wordHighlightStrongBackground":    "#F0635828",
      // Line numbers
      "editorLineNumber.foreground":             "#3a3a38",
      "editorLineNumber.activeForeground":       "#888884",
      // Cursor
      "editorCursor.foreground":                 "#F06358",
      "editorCursor.background":                 "#111111",
      // Find/search
      "editor.findMatchBackground":              "#F0635855",
      "editor.findMatchHighlightBackground":     "#F0635830",
      "editor.findMatchBorder":                  "#F06358",
      // Gutter (error/warning decorations bg)
      "editorGutter.background":                 "#111111",
      // Whitespace / indent guides
      "editorIndentGuide.background1":           "#222220",
      "editorIndentGuide.activeBackground1":     "#444440",
      // Bracket match
      "editorBracketMatch.background":           "#F0635828",
      "editorBracketMatch.border":               "#F06358",
      // Bracket pair colorization — override with neutral so no blues appear
      "editorBracketHighlight.foreground1":      "#888888",
      "editorBracketHighlight.foreground2":      "#888888",
      "editorBracketHighlight.foreground3":      "#888888",
      "editorBracketHighlight.foreground4":      "#888888",
      "editorBracketHighlight.foreground5":      "#888888",
      "editorBracketHighlight.foreground6":      "#888888",
      "editorBracketHighlight.unexpectedBracket.foreground": "#F06358",
      // Scrollbar
      "scrollbarSlider.background":              "#ffffff14",
      "scrollbarSlider.hoverBackground":         "#ffffff22",
      "scrollbarSlider.activeBackground":        "#ffffff30",
      "scrollbar.shadow":                        "#00000000",
      // Widgets (suggest dropdown, hover card, rename)
      "editorWidget.background":                 "#191919",
      "editorWidget.foreground":                 "#E2E2E2",
      "editorWidget.border":                     "#333333",
      "editorWidget.resizeBorder":               "#F06358",
      // Autocomplete dropdown
      "editorSuggestWidget.background":          "#191919",
      "editorSuggestWidget.border":              "#333333",
      "editorSuggestWidget.foreground":          "#E2E2E2",
      "editorSuggestWidget.selectedBackground":  "#F0635828",
      "editorSuggestWidget.selectedForeground":  "#F06358",
      "editorSuggestWidget.highlightForeground": "#F06358",
      "editorSuggestWidget.focusHighlightForeground": "#F5786D",
      // Hover card
      "editorHoverWidget.background":            "#191919",
      "editorHoverWidget.foreground":            "#E2E2E2",
      "editorHoverWidget.border":                "#333333",
      "editorHoverWidget.statusBarBackground":   "#222222",
      // Peek view (go-to-definition inline)
      "peekView.border":                         "#F06358",
      "peekViewTitle.background":                "#191919",
      "peekViewTitleLabel.foreground":           "#E8E8E8",
      "peekViewResult.background":               "#111111",
      "peekViewResult.selectionBackground":      "#F0635828",
      "peekViewEditor.background":               "#111111",
      "peekViewEditorGutter.background":         "#111111",
      // Inline parameter hints
      "editorInlayHint.background":              "#191919",
      "editorInlayHint.foreground":              "#666360",
      // Error / warning squiggles
      "editorError.foreground":                  "#F06358",
      "editorWarning.foreground":                "#D4A853",
      "editorInfo.foreground":                   "#D4A853",
      // Editor overview ruler (right edge minimap)
      "editorOverviewRuler.background":          "#111111",
      "editorOverviewRuler.border":              "#00000000",
      "editorOverviewRuler.errorForeground":     "#F06358",
      "editorOverviewRuler.warningForeground":   "#D4A853",
      // Minimap (disabled but just in case)
      "minimap.background":                      "#111111",
    },
  });

  // Language configuration
  monaco.languages.setLanguageConfiguration("compact", {
    comments: {
      lineComment: "//",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
      ["<", ">"],
    ],
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

  // Completion provider
  monaco.languages.registerCompletionItemProvider("compact", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const snippets: Monaco.languages.CompletionItem[] = [
        {
          label: "contract",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "contract ${1:ContractName} {",
            "\t",
            "\tconstructor() {",
            "\t\t$0",
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
          insertText: "ledger ${1:name}: ${2:Uint<32>};",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a ledger state variable",
          range,
        },
        {
          label: "witness",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "witness ${1:name}: ${2:Uint<32>};",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a private witness variable",
          range,
        },
        {
          label: "pragma",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "pragma language_version >= 0.14.0;",
          documentation: "Add language version pragma",
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
          label: "Uint<32>",
          kind: monaco.languages.CompletionItemKind.TypeParameter,
          insertText: "Uint<${1:32}>",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Unsigned integer type",
          range,
        },
        {
          label: "Bytes<32>",
          kind: monaco.languages.CompletionItemKind.TypeParameter,
          insertText: "Bytes<${1:32}>",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Bytes type of fixed length",
          range,
        },
        {
          label: "Boolean",
          kind: monaco.languages.CompletionItemKind.TypeParameter,
          insertText: "Boolean",
          documentation: "Boolean type",
          range,
        },
      ];

      return { suggestions: snippets };
    },
  });

  // Hover provider
  monaco.languages.registerHoverProvider("compact", {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const docs: Record<string, string> = {
        ledger: "**ledger** — Stores public state on the blockchain. All ledger variables are publicly visible.",
        witness: "**witness** — Private input to a circuit. Never exposed publicly; used in ZK proofs.",
        circuit: "**circuit** — A computation unit that can produce a ZK proof. Exported circuits are callable externally.",
        contract: "**contract** — The top-level smart contract definition.",
        assert: "**assert** — Enforces a constraint. Violations cause circuit failure and transaction rejection.",
        hash: "**hash(...)** — Cryptographic hash function. Used for commitments and proofs.",
        pragma: "**pragma** — Compiler directive. Specifies minimum language version.",
        Uint: `**Uint<N>** — Unsigned integer with N-bit precision. Common sizes: 32, 64, 128.`,
        Bytes: "**Bytes<N>** — Fixed-length byte array. Used for hashes, addresses, and commitments.",
        Boolean: "**Boolean** — True or false value.",
      };

      const doc = docs[word.word];
      if (!doc) return null;

      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
        contents: [{ value: doc }],
      };
    },
  });
}
