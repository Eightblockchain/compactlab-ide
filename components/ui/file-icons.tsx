/**
 * Shared file & folder icons for the CompactLab IDE.
 * Styled after Material Icon Theme with full-colour SVG icons.
 * Used by Sidebar and EditorTabBar.
 */

// ─── Midnight / Compact icon ───────────────────────────────────────────────────

export function MidnightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {/* Moon crescent */}
      <path
        d="M13 8.5A5.5 5.5 0 0 1 7.5 14 5.5 5.5 0 0 1 2 8.5 5.5 5.5 0 0 1 7.5 3a4 4 0 0 0 0 8 4 4 0 0 0 5.5-2.5z"
        fill="#7C5CBF"
      />
      {/* ZK shield */}
      <path
        d="M9.5 4.5L12 5.5v2.5c0 1-.83 1.83-2.5 2.5C7.83 9.83 7 9 7 8V5.5l2.5-1z"
        fill="#A78AE0"
        opacity="0.9"
      />
      <path
        d="M9.5 6.2l1.2.5v1.2c0 .5-.4.9-1.2 1.3-.8-.4-1.2-.8-1.2-1.3V6.7l1.2-.5z"
        fill="#fff"
        opacity="0.85"
      />
    </svg>
  );
}

// ─── Folder icon (Material two-tone) ──────────────────────────────────────────

export function FolderIcon({
  open,
  size = 16,
  color = "#DCB67A",
}: {
  open?: boolean;
  size?: number;
  color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {/* Back layer */}
      <rect x="1" y="5" width="14" height="9" rx="1.5" fill={color} opacity="0.35" />
      {/* Tab */}
      <path d="M1 5.5C1 5.5 1 4 2.5 4H5.5L7 5.5H1z" fill={color} opacity="0.55" />
      {/* Front face */}
      {open ? (
        <path d="M1 6.5h14v6a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5V6.5z" fill={color} />
      ) : (
        <rect x="1" y="5.5" width="14" height="8" rx="1.5" fill={color} />
      )}
      {open && (
        <path d="M1 6.5h14" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.15" />
      )}
    </svg>
  );
}

// ─── Folder colour by name ─────────────────────────────────────────────────────

export function getFolderColor(name: string): string {
  const n = name.toLowerCase();
  if (/^src$|^source$/.test(n)) return "#DCB67A";
  if (/^(dist|build|out|output)$/.test(n)) return "#A3BE8C";
  if (/^(node_modules|\.npm)$/.test(n)) return "#BF616A";
  if (/^(test|tests|__tests__|spec|specs)$/.test(n)) return "#88C0D0";
  if (/^(public|static|assets|media)$/.test(n)) return "#EBCB8B";
  if (/^(components|ui|views|pages|layouts)$/.test(n)) return "#81A1C1";
  if (/^(hooks|composables|mixins)$/.test(n)) return "#B48EAD";
  if (/^(store|stores|state|redux)$/.test(n)) return "#D08770";
  if (/^(utils|helpers|lib|libs|tools)$/.test(n)) return "#8FBCBB";
  if (/^(styles|css|scss|style)$/.test(n)) return "#88BFEF";
  if (/^(types|interfaces|models|schemas)$/.test(n)) return "#A3BE8C";
  if (/^(api|services|service|server)$/.test(n)) return "#E06C75";
  if (/^(config|configs|settings|\.config)$/.test(n)) return "#98C379";
  if (/^(docs|documentation|doc)$/.test(n)) return "#61AFEF";
  if (/^(contracts|contract)$/.test(n)) return "#7C5CBF";
  if (/^(scripts|script)$/.test(n)) return "#E5C07B";
  return "#DCB67A";
}

// ─── File icon key from filename ───────────────────────────────────────────────

export function getFileIconKey(filename: string): string {
  const lower = filename.toLowerCase();
  const parts = lower.split(".");
  if (parts.length >= 3) {
    const last2 = parts.slice(-2).join(".");
    if (last2 === "d.ts") return "dts";
    if (last2 === "test.ts" || last2 === "spec.ts") return "test_ts";
    if (last2 === "test.js" || last2 === "spec.js") return "test_js";
    if (last2 === "test.tsx" || last2 === "spec.tsx") return "test_tsx";
  }
  const ext = parts[parts.length - 1];

  if (lower === "package.json" || lower === "package-lock.json") return "npm";
  if (lower === "tsconfig.json" || lower.startsWith("tsconfig.")) return "tsconfig";
  if (lower === ".eslintrc" || lower.startsWith(".eslintrc")) return "eslint";
  if (lower.startsWith(".prettierrc") || lower === "prettier.config.js") return "prettier";
  if (lower === ".gitignore" || lower === ".gitattributes") return "git";
  if (lower === "dockerfile" || lower === ".dockerignore") return "docker";
  if (lower === "readme.md") return "readme";
  if (lower === "license" || lower === "licence") return "license";
  if (lower === "makefile") return "makefile";
  if (lower.includes("webpack")) return "webpack";
  if (lower.includes("vite.config")) return "vite";
  if (lower.includes("next.config")) return "nextjs";
  if (lower.includes("tailwind.config")) return "tailwind";
  if (lower.includes("jest.config")) return "jest";
  if (lower.includes("babel.config") || lower === ".babelrc") return "babel";
  if (lower.includes("rollup.config")) return "rollup";
  if (lower === "turbo.json") return "turbo";

  switch (ext) {
    case "compact": return "compact";
    case "ts": return "typescript";
    case "tsx": return "tsx";
    case "js": case "mjs": case "cjs": return "javascript";
    case "jsx": return "jsx";
    case "json": case "json5": return "json";
    case "md": return "markdown";
    case "mdx": return "mdx";
    case "rs": return "rust";
    case "py": return "python";
    case "go": return "go";
    case "sol": return "solidity";
    case "css": return "css";
    case "scss": return "scss";
    case "sass": return "sass";
    case "less": return "less";
    case "html": return "html";
    case "svg": return "svg";
    case "png": case "jpg": case "jpeg": case "gif": case "webp": case "avif": return "image";
    case "sh": case "bash": case "zsh": return "shell";
    case "yml": case "yaml": return "yaml";
    case "toml": return "toml";
    case "env": return "env";
    case "lock": return "lock";
    case "wasm": return "wasm";
    case "graphql": case "gql": return "graphql";
    case "prisma": return "prisma";
    default: return "default";
  }
}

// ─── FileIcon component ────────────────────────────────────────────────────────

export function FileIcon({ filename, size = 14 }: { filename: string; size?: number }) {
  const key = getFileIconKey(filename);
  const s = size;
  const dim = { width: s, height: s, viewBox: "0 0 16 16" as const };

  switch (key) {
    case "compact":
      return <MidnightIcon size={s} />;

    case "typescript":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#3178C6" />
          <path d="M10.5 8.5h1.5A2.5 2.5 0 1110 11v-.5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 8.5h4M7 8.5V13" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "dts":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#3178C6" opacity="0.75" />
          <path d="M5 8.5h4M7 8.5V13" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
          <text x="8.5" y="6.5" fill="#fff" fontSize="5" fontWeight="bold" fontFamily="monospace">d</text>
        </svg>
      );
    case "test_ts":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#3178C6" />
          <path d="M4 8.5h5M6.5 8.5V13" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="12" cy="4" r="2.5" fill="#A3E635" />
          <path d="M11 4l.7.7 1.3-1.3" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case "tsx":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#1DA6B8" />
          <path d="M3 9.5C3 9.5 5 7 8 10c3-3 5-.5 5-.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M5 8.5h3.5M6.75 8.5V12" stroke="#fff" strokeWidth="1.15" strokeLinecap="round" />
        </svg>
      );
    case "test_tsx":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#1DA6B8" />
          <path d="M3 9.5C3 9.5 5 7 8 10c3-3 5-.5 5-.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="12" cy="4" r="2.5" fill="#A3E635" />
          <path d="M11 4l.7.7 1.3-1.3" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case "javascript":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#F7DF1E" />
          <path d="M5.5 12.5C5.5 13.3 6 13.8 6.8 13.8s1.5-.5 1.5-1.5V8.5H7" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M10.5 8.5c-1.2 0-2 .8-2 2s.8 1.5 2 2 1.8.5 1.8 1.3-.6 1-1.5 1" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "jsx":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#F0AE4B" />
          <path d="M3 9.5C3 9.5 5 7 8 10c3-3 5-.5 5-.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M6.5 12.5C6.5 13.3 7 13.8 7.5 13.8" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "test_js":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#F7DF1E" />
          <path d="M5.5 12.5C5.5 13.3 6 13.8 6.8 13.8s1.5-.5 1.5-1.5V8.5H7" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="12" cy="4" r="2.5" fill="#A3E635" />
          <path d="M11 4l.7.7 1.3-1.3" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case "json":
      return (
        <svg {...dim} fill="none">
          <path d="M4 3c-1.5 0-2 .8-2 2v2c0 1-.5 1.5-1 1.5.5 0 1 .5 1 1.5v2c0 1.2.5 2 2 2" stroke="#F0C674" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M12 3c1.5 0 2 .8 2 2v2c0 1 .5 1.5 1 1.5-.5 0-1 .5-1 1.5v2c0 1.2-.5 2-2 2" stroke="#F0C674" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="6.5" cy="8" r="0.9" fill="#F0C674" />
          <circle cx="8" cy="8" r="0.9" fill="#F0C674" />
          <circle cx="9.5" cy="8" r="0.9" fill="#F0C674" />
        </svg>
      );
    case "tsconfig":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#3178C6" opacity="0.85" />
          <path d="M4 8h2.5M6.5 8v4.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="11" cy="10.5" r="2" stroke="#fff" strokeWidth="1.2" />
          <path d="M11 8.5v.5M11 12v.5" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );
    case "npm":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#CB3837" />
          <rect x="3" y="5.5" width="10" height="7" rx="0.5" fill="#fff" />
          <rect x="5.5" y="8" width="2.5" height="4.5" fill="#CB3837" />
        </svg>
      );

    case "markdown":
    case "readme":
      return (
        <svg {...dim} fill="none">
          <rect x="1" y="2.5" width="14" height="11" rx="1.5" stroke="#519ABA" strokeWidth="1.2" fill="none" />
          <path d="M3.5 10V6.5L5.5 9l2-2.5V10" stroke="#519ABA" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 6.5v3.5M9 9l1.5 1.5 1.5-1.5" stroke="#519ABA" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "mdx":
      return (
        <svg {...dim} fill="none">
          <rect x="1" y="2.5" width="14" height="11" rx="1.5" stroke="#F9AC00" strokeWidth="1.2" fill="none" />
          <path d="M3.5 10V6.5L5.5 9l2-2.5V10" stroke="#F9AC00" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 6.5l2 3.5M12 6.5l-2 3.5" stroke="#F9AC00" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );

    case "rust":
      return (
        <svg {...dim} fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="#CE422B" strokeWidth="1.3" />
          <circle cx="8" cy="8" r="2.5" fill="#CE422B" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" stroke="#CE422B" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M3.6 3.6l1.4 1.4M11 11l1.4 1.4M3.6 12.4l1.4-1.4M11 5l1.4-1.4" stroke="#CE422B" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case "python":
      return (
        <svg {...dim} fill="none">
          <path d="M8 2C5.5 2 4 3 4 4.5V7h4v1H3C1.5 8 1 9 1 10.5 1 12.3 2 13.5 4 13.5h1.5v-2c0-1 .6-1.5 1.5-1.5h2c1.5 0 2.5-1 2.5-2.5V4.5C11.5 3 10 2 8 2z" fill="#4B8BBE" />
          <path d="M8.5 14.2c2.5 0 4-1 4-2.5V9h-4V8h5c1.5 0 2-1 2-2.5 0-1.8-1-3-3-3H11V5c0 1-.6 1.5-1.5 1.5h-2c-1.5 0-2.5 1-2.5 2.5v3.2c0 1.5 1.5 2.5 3.5 2.5z" fill="#FFE873" />
          <circle cx="7" cy="4.8" r=".7" fill="#fff" />
          <circle cx="9" cy="11.5" r=".7" fill="#4B8BBE" />
        </svg>
      );

    case "go":
      return (
        <svg {...dim} fill="none">
          <path d="M3.5 8.5h2M10.5 8.5h2" stroke="#00ACD7" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="5.5" cy="8" r="2.5" stroke="#00ACD7" strokeWidth="1.3" fill="none" />
          <path d="M5.5 5.5V3M8 5.5C8 4 9 3 10.5 3s2.5 1 2.5 3v5c0 1.5-1 2.5-2.5 2.5S8 12.5 8 11V5.5z" stroke="#00ACD7" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );

    case "solidity":
      return (
        <svg {...dim} fill="none">
          <path d="M8 2L4 5l4 3-4 3 4 3 4-3-4-3 4-3-4-3z" stroke="#6F7CBA" strokeWidth="1.15" strokeLinejoin="round" fill="none" />
          <path d="M5 5.5L8 8M8 8l3-2.5" stroke="#8892C8" strokeWidth="0.9" strokeLinecap="round" />
        </svg>
      );

    case "css":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#42A5F5" />
          <path d="M3.5 5h9L12 11.5 8 12.5l-4-1-.5-3.5H11M5 7.5h5.5" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "scss":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#CF649A" />
          <path d="M5 5c3 0 5 1 5 2.5S8 9.5 8 11s.5 1.5 2 1-1-3.5-1-3.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "sass":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#CF649A" opacity="0.85" />
          <path d="M5 6c3 0 5 .8 5 2S8 9.5 8 11s.5 1.5 2 1" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "less":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#1D365D" />
          <path d="M3 11l3-3-3-3M7 11h4" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case "html":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#E34C26" />
          <path d="M3.5 5h9L12 11.5 8 12.3l-4-.8-.5-3.5H11M5 7.5h5.5" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case "svg":
      return (
        <svg {...dim} fill="none">
          <rect x="1" y="1" width="14" height="14" rx="2" stroke="#FFB13B" strokeWidth="1.2" fill="none" />
          <circle cx="5.5" cy="5.5" r="1.5" fill="#FF6B35" />
          <path d="M3 13L6 9l2.5 2.5L10 9l3 4H3z" fill="#FFB13B" opacity="0.85" />
        </svg>
      );

    case "image":
      return (
        <svg {...dim} fill="none">
          <rect x="1" y="2" width="14" height="12" rx="1.5" stroke="#A78AE0" strokeWidth="1.2" fill="none" />
          <circle cx="5.5" cy="5.5" r="1.5" fill="#A78AE0" opacity="0.7" />
          <path d="M1.5 12L5 8.5l2.5 2.5L10 7.5l4.5 6H1.5z" fill="#A78AE0" opacity="0.5" />
        </svg>
      );

    case "shell":
      return (
        <svg {...dim} fill="none">
          <rect x="1" y="1" width="14" height="14" rx="2" fill="#1a1a2e" stroke="#4EC9B0" strokeWidth="1" />
          <path d="M4 5.5L6.5 8 4 10.5" stroke="#4EC9B0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7.5 11h4" stroke="#4EC9B0" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );

    case "yaml":
      return (
        <svg {...dim} fill="none">
          <path d="M8 2v5M5 3.5L8 7l3-3.5" stroke="#CC3D47" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 9h10M3 12h7" stroke="#CC3D47" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );

    case "toml":
      return (
        <svg {...dim} fill="none">
          <path d="M3 4h10M8 4v9" stroke="#9C4221" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M4 10h8" stroke="#9C4221" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );

    case "env":
      return (
        <svg {...dim} fill="none">
          <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="#ECC94B" strokeWidth="1.1" fill="none" />
          <path d="M4 5.5h8M4 8h5M4 10.5h7" stroke="#ECC94B" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case "lock":
      return (
        <svg {...dim} fill="none">
          <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="#A0AEC0" strokeWidth="1.2" fill="none" />
          <path d="M5 7V5.5a3 3 0 016 0V7" stroke="#A0AEC0" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8" cy="11" r="1.2" fill="#A0AEC0" />
        </svg>
      );

    case "wasm":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="2.5" fill="#654FF0" />
          <path d="M3 5l2 6M5 5l1 4 1-4M7 5l2 6M9 5l2 6M11 5l2 6" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case "graphql":
      return (
        <svg {...dim} fill="none">
          <path d="M8 2l6 3.5v7L8 16l-6-3.5v-7L8 2z" stroke="#E535AB" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
          <circle cx="8" cy="2" r="1.3" fill="#E535AB" />
          <circle cx="14" cy="5.5" r="1.3" fill="#E535AB" />
          <circle cx="14" cy="10.5" r="1.3" fill="#E535AB" />
          <circle cx="8" cy="14" r="1.3" fill="#E535AB" />
          <circle cx="2" cy="10.5" r="1.3" fill="#E535AB" />
          <circle cx="2" cy="5.5" r="1.3" fill="#E535AB" />
          <path d="M2 5.5h12M2 10.5h12" stroke="#E535AB" strokeWidth="0.8" />
        </svg>
      );

    case "prisma":
      return (
        <svg {...dim} fill="none">
          <path d="M8 2L4 14h8L8 2z" stroke="#5A67D8" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
          <path d="M6 10l2-6 2 6" stroke="#5A67D8" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case "git":
      return (
        <svg {...dim} fill="none">
          <path d="M14 8l-6 6-6-6 6-6 6 6z" stroke="#F05033" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
          <circle cx="8" cy="8" r="1.8" fill="#F05033" />
          <path d="M8 5V3M8 13v-2M11 8h2M3 8h2" stroke="#F05033" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      );

    case "docker":
      return (
        <svg {...dim} fill="none">
          <path d="M14 7.5C14 7.5 13 5.5 11 6.5H9.5V5H7.5V6.5H5.5V5H3.5V6.5H2a2 2 0 000 4h10.5a2 2 0 001.5-3z" stroke="#2496ED" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <rect x="5.5" y="5" width="2" height="1.5" rx="0.3" fill="#2496ED" />
          <rect x="7.5" y="5" width="2" height="1.5" rx="0.3" fill="#2496ED" />
        </svg>
      );

    case "eslint":
      return (
        <svg {...dim} fill="none">
          <path d="M8 2.5L2 6v8h12V6L8 2.5z" stroke="#4B32C3" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
          <path d="M5 9.5L8 7l3 2.5-3 2.5-3-2.5z" fill="#4B32C3" />
        </svg>
      );

    case "prettier":
      return (
        <svg {...dim} fill="none">
          <path d="M4 4h5M4 7h8M4 10h3M4 13h6" stroke="#56B3B4" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="12" cy="4" r="1.5" fill="#EA5E5E" />
        </svg>
      );

    case "webpack":
      return (
        <svg {...dim} fill="none">
          <path d="M8 1L2 4.5v7L8 15l6-3.5v-7L8 1z" stroke="#8DD6F9" strokeWidth="1.1" strokeLinejoin="round" fill="none" />
          <path d="M8 1v5M8 10v5M2 4.5L8 8M14 4.5L8 8M2 11.5L8 8M14 11.5L8 8" stroke="#8DD6F9" strokeWidth="0.9" strokeLinecap="round" />
        </svg>
      );

    case "vite":
      return (
        <svg {...dim} fill="none">
          <path d="M14 2L8 14 6 8l-4-1 12-5z" fill="#646CFF" />
          <path d="M8 14L5 4l3 4z" fill="#FF6340" />
        </svg>
      );

    case "nextjs":
      return (
        <svg {...dim} fill="none">
          <rect width="16" height="16" rx="8" fill="#1a1a1a" />
          <path d="M10.5 11.5L6 5.5H5V11h1V7l4 5.5h.5V5.5H10v5.5l.5.5z" fill="#fff" />
        </svg>
      );

    case "tailwind":
      return (
        <svg {...dim} fill="none">
          <path d="M8 4C6 4 4.5 5 4 7c.5-1 1.5-1.5 2.5-1C7 6.5 7.5 7.5 8.5 8c2 1 3.5.5 4-1.5C12 8 11 9 10 8.5c-.5-.5-1-1.5-2-2.5zM4.5 9.5C2.5 9.5 1 10.5.5 12.5c.5-1 1.5-1.5 2.5-1 .5.5 1 1.5 2 2.5 2 1 3.5.5 4-.5C8.5 15 7.5 16 6.5 15.5c-.5-.5-1-1.5-2-2z" fill="#38BDF8" />
        </svg>
      );

    case "jest":
      return (
        <svg {...dim} fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="#C63D14" strokeWidth="1.2" fill="none" />
          <path d="M8 4.5L9.5 7.5H12L10 9.5l.8 3L8 11l-2.8 1.5.8-3L4 7.5h2.5L8 4.5z" fill="#C63D14" />
        </svg>
      );

    case "babel":
      return (
        <svg {...dim} fill="none">
          <path d="M2 12L8 3M8 3l6 9M8 3v10" stroke="#F5DB53" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case "rollup":
      return (
        <svg {...dim} fill="none">
          <circle cx="8" cy="5" r="2.5" stroke="#FF3333" strokeWidth="1.2" fill="none" />
          <circle cx="8" cy="11" r="2.5" stroke="#FF3333" strokeWidth="1.2" fill="none" />
          <path d="M8 7.5v1" stroke="#FF3333" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case "turbo":
      return (
        <svg {...dim} fill="none">
          <circle cx="8" cy="8" r="6.5" fill="#0F0F0F" stroke="#0F0F0F" strokeWidth="1" />
          <circle cx="8" cy="8" r="3" fill="none" stroke="#FF1E56" strokeWidth="1.5" />
          <path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="#FF1E56" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case "license":
      return (
        <svg {...dim} fill="none">
          <path d="M4 2h8l2 2v10H2V2h2z" stroke="#FBBF24" strokeWidth="1.1" strokeLinejoin="round" fill="none" />
          <path d="M5 7h6M5 9.5h4M5 12h5" stroke="#FBBF24" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="10.5" cy="4" r="1" fill="#FBBF24" />
        </svg>
      );

    case "makefile":
      return (
        <svg {...dim} fill="none">
          <path d="M3.5 3.5L8 8l4.5-4.5M3.5 6L8 10.5 12.5 6" stroke="#6D8086" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    default:
      return (
        <svg {...dim} fill="none">
          <path d="M3 2h6.5L13 5.5V14H3V2z" stroke="#636360" strokeWidth="1.1" strokeLinejoin="round" fill="none" />
          <path d="M9.5 2v3.5H13" stroke="#636360" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
