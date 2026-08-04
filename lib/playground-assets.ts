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
  return `/contracts/managed/${safeId}`;
}

export function isDeployableTemplate(template: string): template is DeployableTemplate {
  return (BUNDLED_DEPLOYABLE as readonly string[]).includes(template);
}

/** True if template is bundled OR the project has a full-ZK artifact URL. */
export function canDeployProject(template: string, artifactBaseUrl?: string | null): boolean {
  return !!artifactBaseUrl || isDeployableTemplate(template);
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
