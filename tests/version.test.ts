import { describe, expect, it } from "vitest";
import { COMPACT_PRAGMA, normalizeCompactPragma } from "../lib/version";

describe("normalizeCompactPragma", () => {
  it("keeps a pragma that matches the pinned language version", () => {
    const code = "pragma language_version >= 0.23;\n\nimport CompactStandardLibrary;\n";
    expect(normalizeCompactPragma(code)).toEqual({ code, changed: false });
  });

  it("rewrites a compiler-package version mistaken for a language version", () => {
    const { code, changed } = normalizeCompactPragma("pragma language_version >= 0.31;\n");
    expect(changed).toBe(true);
    expect(code).toBe(`${COMPACT_PRAGMA}\n`);
  });

  it("adds the pragma when it is missing", () => {
    const { code, changed } = normalizeCompactPragma("import CompactStandardLibrary;\n");
    expect(changed).toBe(true);
    expect(code.startsWith(COMPACT_PRAGMA)).toBe(true);
  });
});
