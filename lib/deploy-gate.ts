/**
 * Deploy readiness:
 * - Hello World / Counter (unedited): bundled Preprod assets → Deploy without Compile
 * - Everything else: full ZK Compile first, then Deploy
 * - Never compiled (and not bundled Instant Deploy) → Deploy disabled
 */

import { COMPACT_TEMPLATES } from "@/lib/constants";
import { isDeployableTemplate, isOutdatedManagedArtifactUrl, OUTDATED_ARTIFACT_MESSAGE } from "@/lib/playground-assets";

export function fingerprintSource(code: string): string {
  const normalized = code.replace(/\r\n/g, "\n").trim();
  let h = 5381;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) + h) ^ normalized.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export function getProjectCompactSource(files: Array<{ language: string; content: string }>): string {
  const compact = files.find((f) => f.language === "compact");
  return compact?.content ?? "";
}

/** Prefer open editor / tab buffer over saved file content. */
export function getLiveCompactSource(options: {
  files: Array<{ id: string; language: string; content: string }>;
  activeFileId?: string | null;
  code?: string;
  tabBuffers?: Record<string, string>;
}): string {
  const compact = options.files.find((f) => f.language === "compact");
  if (!compact) return "";
  if (options.activeFileId === compact.id && options.code !== undefined) {
    return options.code;
  }
  if (options.tabBuffers && options.tabBuffers[compact.id] !== undefined) {
    return options.tabBuffers[compact.id];
  }
  return compact.content;
}

export function getTemplateCompactSource(template: string): string | null {
  const tpl = COMPACT_TEMPLATES[template as keyof typeof COMPACT_TEMPLATES];
  if (!tpl) return null;
  return tpl.files.find((f) => f.language === "compact")?.content ?? null;
}

export type DeployGate = {
  canDeploy: boolean;
  needsCompile: boolean;
  usingBundled: boolean;
  /** True when this project has a successful full ZK compile for the current source. */
  hasCompiled: boolean;
  reason: string;
};

export function getDeployGate(options: {
  template: string;
  artifactBaseUrl?: string | null;
  compiledSourceHash?: string | null;
  currentSource: string;
}): DeployGate {
  const hash = fingerprintSource(options.currentSource || "");
  const hasMatchingCompile =
    !!options.artifactBaseUrl &&
    !!options.compiledSourceHash &&
    options.compiledSourceHash === hash;

  if (options.artifactBaseUrl) {
    if (isOutdatedManagedArtifactUrl(options.artifactBaseUrl)) {
      return {
        canDeploy: false,
        needsCompile: true,
        usingBundled: false,
        hasCompiled: false,
        reason: OUTDATED_ARTIFACT_MESSAGE,
      };
    }
    if (!options.compiledSourceHash || options.compiledSourceHash !== hash) {
      return {
        canDeploy: false,
        needsCompile: true,
        usingBundled: false,
        hasCompiled: false,
        reason: options.compiledSourceHash
          ? "Source changed since last Compile. Run Compile, then Deploy."
          : "This project has never been compiled for the current source. Run Compile, then Deploy.",
      };
    }
    return {
      canDeploy: true,
      needsCompile: false,
      usingBundled: false,
      hasCompiled: true,
      reason: "Compiled. Deploy with 1AM on Preprod.",
    };
  }

  if (isDeployableTemplate(options.template)) {
    const baseline = getTemplateCompactSource(options.template);
    if (baseline && fingerprintSource(baseline) !== hash) {
      return {
        canDeploy: false,
        needsCompile: true,
        usingBundled: false,
        hasCompiled: false,
        reason:
          "You edited the contract. Run Compile, then Deploy (bundled keys no longer match).",
      };
    }
    return {
      canDeploy: true,
      needsCompile: false,
      usingBundled: true,
      hasCompiled: hasMatchingCompile,
      reason:
        "Bundled Preprod keys ready (Hello/Counter). Optional: Compile your own keys, then Deploy.",
    };
  }

  return {
    canDeploy: false,
    needsCompile: true,
    usingBundled: false,
    hasCompiled: false,
    reason: "This project has never been compiled. Run Compile, then Deploy.",
  };
}

/** Prefer project-state badge over static template badge. */
export function deployStatusLabel(options: {
  template: string;
  artifactBaseUrl?: string | null;
  compiledSourceHash?: string | null;
  currentSource: string;
}): { label: string; tone: "success" | "warn" | "muted" } {
  const gate = getDeployGate(options);
  if (gate.canDeploy && gate.usingBundled) {
    return { label: "Bundled · Deploy ready", tone: "success" };
  }
  if (gate.canDeploy) {
    return { label: "Compiled · Deploy ready", tone: "success" };
  }
  if (gate.needsCompile) {
    return { label: "Compile then Deploy", tone: "warn" };
  }
  return { label: "Compile required", tone: "muted" };
}
