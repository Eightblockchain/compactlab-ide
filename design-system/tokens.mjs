/**
 * CompactLab design tokens — the single source of truth for every app
 * (playground, admin, landing page). Edit here, then run:
 *
 *   node compactlab/design-system/sync.mjs          # write into every app
 *   node compactlab/design-system/sync.mjs --check  # fail on drift (CI)
 *
 * All apps are dark-only. Values are kept exactly as the playground shipped them.
 */

/** Brand identity: safe for every app, including marketing pages. */
export const colors = {
  /** Logo coral (cl-logo.svg). Marketing CTAs and the wordmark. */
  brand: "#E95144",
  /** Product UI accent: a lighter coral tuned for dense dark surfaces. */
  accent: "#F06358",
  "accent-hover": "#f47b71",
  "accent-dim": "rgba(240,99,88,0.14)",

  /** Surfaces: shell → panel → raised (menus, cards). */
  background: "#09090b",
  surface: "#0c0c0e",
  "surface-2": "#151518",
  "surface-muted": "#070708",
  border: "rgba(255,255,255,0.07)",
  "border-strong": "rgba(255,255,255,0.13)",

  "text-primary": "#ececee",
  "text-secondary": "#a1a1aa",
  "text-muted": "#71717a",
  "text-dim": "#46464d",

  /** Status colours are reserved for state; never reuse them as chart series. */
  success: "#4fbf86",
  warning: "#e0a84f",
  error: "#f06358",
  info: "#8aa4f8",
};

/**
 * Categorical chart palette, in fixed order (never cycle; fold extras into
 * "Other"). Validated against `surface` (#0c0c0e): lightness band, chroma,
 * adjacent CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19.3, contrast ≥ 3:1.
 * Single-series charts use `accent` instead.
 */
export const chart = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export const fonts = {
  /** next/font sets --font-inter / --font-jetbrains-mono; otherwise the Google Fonts family names apply. */
  sans: "var(--font-inter, 'Inter'), system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono, 'JetBrains Mono'), 'Fira Code', monospace",
};

/**
 * Product density (playground, admin). Not for the landing page, whose
 * marketing layout uses Tailwind's default type scale.
 */
export const product = {
  text: { "2xs": "10px", xs: "11px", sm: "12px", base: "13px", md: "14px", lg: "15px", xl: "16px", "2xl": "18px" },
  radius: { sm: "4px", DEFAULT: "6px", md: "8px", lg: "10px", xl: "12px" },
};
