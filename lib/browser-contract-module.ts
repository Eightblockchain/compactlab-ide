/**
 * Load Compact-generated contract/index.js in the browser.
 *
 * Compiler output uses bare ESM: `import … from '@midnight-ntwrk/compact-runtime'`.
 * Browsers cannot resolve that. Importing the file via a raw URL
 * (`import(origin + '/contracts/…/index.js')`) therefore fails with:
 *   Failed to resolve module specifier "@midnight-ntwrk/compact-runtime"
 *
 * We bind contracts to the app's single bundled compact-runtime instance —
 * required for WASM `instanceof` checks (CostModel, QueryContext, …). Then
 * rewrite the contract source and evaluate it from a blob: URL.
 *
 * IMPORTANT: do not statically import compact-runtime or public/contracts here —
 * this module is reachable from client panels and would crash SSR.
 */

const RUNTIME_GLOBAL = "__MN_COMPACT_RUNTIME__" as const;

function rewriteCompactRuntimeImports(src: string): string {
  let out = src.replace(
    /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]@midnight-ntwrk\/compact-runtime['"]\s*;?/g,
    `const $1 = globalThis.${RUNTIME_GLOBAL};`,
  );

  out = out.replace(
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]@midnight-ntwrk\/compact-runtime['"]\s*;?/g,
    `const $1 = globalThis.${RUNTIME_GLOBAL}.default ?? globalThis.${RUNTIME_GLOBAL};`,
  );

  out = out.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]@midnight-ntwrk\/compact-runtime['"]\s*;?/g,
    (_m, names: string) =>
      names
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((part) => {
          const [orig, alias] = part.split(/\s+as\s+/).map((x) => x.trim());
          const local = alias || orig;
          return `const ${local} = globalThis.${RUNTIME_GLOBAL}.${orig};`;
        })
        .join("\n"),
  );

  return out;
}

async function ensureRuntimeGlobal(): Promise<void> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[RUNTIME_GLOBAL]) return;
  const compactRuntime = await import("@midnight-ntwrk/compact-runtime");
  g[RUNTIME_GLOBAL] = compactRuntime;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadBrowserContractModule(assetBase: string): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("Contract modules can only be loaded in the browser.");
  }

  await ensureRuntimeGlobal();

  const url = `${window.location.origin}${assetBase}/contract/index.js`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch contract module (${res.status}): ${url}`);
  }

  const src = await res.text();
  const rewritten = rewriteCompactRuntimeImports(src);
  if (rewritten === src && src.includes("@midnight-ntwrk/compact-runtime")) {
    throw new Error(
      "Could not rewrite @midnight-ntwrk/compact-runtime import in contract/index.js",
    );
  }

  const blobUrl = URL.createObjectURL(new Blob([rewritten], { type: "text/javascript" }));
  try {
    return await import(/* webpackIgnore: true */ blobUrl);
  } finally {
    // Keep the blob URL alive briefly while the module graph finishes evaluating.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}
