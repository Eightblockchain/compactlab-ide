// ─── App versioning ────────────────────────────────────────────────────────────
// Bump this whenever a release is tagged. Displayed in the Sidebar footer.

export const APP_VERSION = "1.0.0";

// ─── Compact toolchain pins ────────────────────────────────────────────────────
// Compact CLI `compile +X.Y.Z` selects a *compiler package*. That package
// implements a *language version* (pragma) and a *runtime version*.
// Example from `compiler/contract-info.json` for +0.31.1:
//   { "compiler-version": "0.31.1", "language-version": "0.23.0", "runtime-version": "0.16.0" }
// Pins follow Midnight docs compatibility matrix (Preview/Preprod latest).
// User-facing version switching is disabled until v2 admin tooling.

/** Compact compiler package pin — `compact compile +${COMPACT_COMPILER_PACKAGE}`. */
export const COMPACT_COMPILER_PACKAGE = "0.31.1";

/**
 * Compact language version required by the pinned compiler package.
 * Must match `language-version` in compile output — used in `pragma language_version`.
 */
export const COMPACT_LANGUAGE_VERSION = "0.23";

/** Full language version string (major.minor.patch) for exact pragma form. */
export const COMPACT_LANGUAGE_VERSION_FULL = "0.23.0";

/** Default pragma line for new .compact files / completions. */
export const COMPACT_PRAGMA =
  `pragma language_version >= ${COMPACT_LANGUAGE_VERSION};` as const;

/**
 * Ensure source uses a pragma compatible with the pinned compiler package.
 * Fixes mistaken `>= 0.31` (compiler package ≠ language version).
 */
export function normalizeCompactPragma(code: string): { code: string; changed: boolean } {
  const pragmaRe = /^(\s*pragma\s+language_version\s*)(>=?\s*)?([\d.]+)(\s*;)/m;
  const match = code.match(pragmaRe);
  if (!match) {
    const next = `${COMPACT_PRAGMA}\n\n${code.replace(/^\uFEFF/, "")}`;
    return { code: next, changed: true };
  }

  const requested = match[3];
  const majorMinor = requested.split(".").slice(0, 2).join(".");
  // Language 0.23 is what +0.31.1 implements. Keep compatible pragmas as-is.
  if (majorMinor === COMPACT_LANGUAGE_VERSION) {
    return { code, changed: false };
  }

  const next = code.replace(pragmaRe, `$1>= ${COMPACT_LANGUAGE_VERSION}$4`);
  return { code: next, changed: next !== code };
}

/** @deprecated Alias for persisted IDE state; always equals COMPACT_LANGUAGE_VERSION. */
export type CompactVersion = string;
export const COMPACT_STABLE_VERSION: CompactVersion = COMPACT_LANGUAGE_VERSION;
export const COMPACT_VERSIONS = [COMPACT_LANGUAGE_VERSION] as const;
