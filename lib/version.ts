// ─── App versioning ────────────────────────────────────────────────────────────
// Bump this whenever a release is tagged. Displayed in the Sidebar footer.

export const APP_VERSION = "1.0.0";

// ─── Compact language versions ─────────────────────────────────────────────────
// Listed newest-first. Add new versions here as Midnight releases them.

export const COMPACT_VERSIONS = ["0.21", "0.20", "0.19"] as const;
export type CompactVersion = (typeof COMPACT_VERSIONS)[number];

// The default version used for new files and the pragma completion snippet.
export const COMPACT_STABLE_VERSION: CompactVersion = "0.21";
