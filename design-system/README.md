# CompactLab design system

One source of truth for the look of every CompactLab app: the playground (`compactlab`), the operator console (`admin`) and the marketing site (`landing-page`).

Each app is its own repo and deploys on its own, so the apps don't import this folder at runtime. The sync script writes a committed copy of the generated files into each app instead, the same way the toolchain pins are guarded.

```bash
# from the workspace root (the folder holding compactlab/, admin/, landing-page/)
node compactlab/design-system/sync.mjs          # write into every app
node compactlab/design-system/sync.mjs --check  # exit 1 if an app drifted (or: pnpm design:check in compactlab)
```

Apps that are not checked out next to `compactlab` are skipped.

## What's here

| File | Purpose |
| --- | --- |
| `tokens.mjs` | **Edit this.** Colours, chart palette, fonts, product density. |
| `brand/` | Logo and icons, copied to each app's `public/`. |
| `sync.mjs` | Generates the files below. |

Generated into each app (do not edit them there):

| Generated file | Used by | Contains |
| --- | --- | --- |
| `styles/compactlab-tokens.css` | all apps | Tailwind v4 `@theme static`: `--color-*`, `--color-chart-1…8`, `--font-sans`, `--font-mono` |
| `styles/compactlab-product.css` | playground, admin | Dense type scale (`text-xs` = 11px), radii, animations |
| `lib/design-tokens.ts` | all apps | The same values for chart libraries, canvas and SVG attributes |

Import the CSS right after Tailwind in the app's `globals.css`:

```css
@import "tailwindcss";
@import "../styles/compactlab-tokens.css";
@import "../styles/compactlab-product.css"; /* product apps only */
```

## Using the tokens

- **Utilities:** `bg-surface`, `bg-surface-2`, `border-border`, `text-text-secondary`, `text-accent`, `bg-success/15` and so on.
- **Inline styles:** `style={{ color: "var(--color-brand)" }}`. Every variable is always emitted (`@theme static`).
- **Charts:** `import { chartPalette, colors } from "@/lib/design-tokens"`.

### Colour roles

- `brand` `#E95144` is the logo coral. Use it on marketing pages and for the wordmark.
- `accent` `#F06358` is the product UI accent: buttons, active nav, focus rings, single-series charts.
- `success` / `warning` / `error` / `info` are reserved for state. Never use them as a chart series, and pair them with a label or icon.
- Surfaces step from `background` (shell) to `surface` (panels) to `surface-2` (menus, dialogs, tooltips), separated by hairline `border`.

### Charts

`chart` is a fixed-order categorical palette, validated on the `surface` colour for lightness band, chroma, colour-blind separation (adjacent ΔE ≥ 8.4), normal-vision separation (ΔE ≥ 19.3) and ≥ 3:1 contrast. Assign slots in order and never cycle; fold a ninth series into "Other". If you change any value, re-validate the set.

### Density

The playground and admin use the dense product scale (13px body, 11px `text-xs`). The landing page keeps Tailwind's default scale and a pure-black canvas (its own `--color-background`), but shares colours, fonts and the logo.

## Shared component patterns

Components live in each app because they depend on app-local helpers. Keep these in step with `compactlab/components/ui`:

- **Button:** `default`, `ghost`, `accent`, `danger` variants with the same classes.
- **Badge:** `default`, `success`, `warning`, `error`, `info` (+ `accent`), with an optional dot.
- **Cards:** `rounded-lg border border-border bg-surface`.
- **Inputs:** `bg-surface-muted`, hairline border, accent focus ring.
