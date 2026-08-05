/**
 * Lightweight deployability helpers — safe to import from client UI.
 * Must NOT import @midnight-ntwrk/ledger-v8 or other Node/WASM modules.
 */

/** Bundled templates that ship ZK assets under /public/contracts/<slug>/. */
export const BUNDLED_DEPLOYABLE = ["hello-world", "counter"] as const;
export type DeployableTemplate = (typeof BUNDLED_DEPLOYABLE)[number];
export const DEPLOYABLE_TEMPLATES = BUNDLED_DEPLOYABLE;

export function bundledAssetBase(slug: string): string {
  return `/contracts/${slug}`;
}

export function managedAssetBase(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  return `${api.replace(/\/$/, "")}/v1/zk/${safeId}`;
}

export function isDeployableTemplate(template: string): template is DeployableTemplate {
  return (BUNDLED_DEPLOYABLE as readonly string[]).includes(template);
}

/** True if template is bundled OR the project has a full-ZK artifact URL. */
export function canDeployProject(template: string, artifactBaseUrl?: string | null): boolean {
  return !!artifactBaseUrl || isDeployableTemplate(template);
}

/**
 * Normalize a ZK asset base (relative `/contracts/…` or absolute API URL)
 * into a browser-absolute URL with no trailing slash.
 *
 * Managed compiles return `http://localhost:4000/v1/zk/<id>` from the API —
 * those must NOT be prefixed with `window.location.origin` or `new URL` fails.
 */
export function toAbsoluteAssetUrl(assetBase: string): string {
  const trimmed = assetBase.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("Empty ZK asset base URL");
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (typeof window === "undefined") {
    return path;
  }
  return `${window.location.origin}${path}`;
}

/** Resolve asset base for a template or managed compile. */
export function resolveAssetBase(options: {
  template: string;
  artifactBaseUrl?: string | null;
  projectId?: string | null;
}): { slug: string; assetBase: string } {
  if (options.artifactBaseUrl) {
    return {
      slug: options.template || "managed",
      assetBase: options.artifactBaseUrl,
    };
  }
  if (isDeployableTemplate(options.template)) {
    return {
      slug: options.template,
      assetBase: bundledAssetBase(options.template),
    };
  }
  throw new Error(
    `No ZK assets for template "${options.template}". Run a full ZK compile, or use a deployable template.`,
  );
}
