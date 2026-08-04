/**
 * Deploy readiness: bundled templates only when source matches the template;
 * otherwise require a full ZK Compile whose source hash still matches.
 */

import { COMPACT_TEMPLATES } from "@/lib/constants";
import { isDeployableTemplate } from "@/lib/playground-assets";

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
  reason: string;
};

export function getDeployGate(options: {
  template: string;
  artifactBaseUrl?: string | null;
  compiledSourceHash?: string | null;
  currentSource: string;
}): DeployGate {
  const hash = fingerprintSource(options.currentSource || "");

  if (options.artifactBaseUrl) {
    if (!options.compiledSourceHash || options.compiledSourceHash !== hash) {
      return {
        canDeploy: false,
        needsCompile: true,
        usingBundled: false,
        reason: options.compiledSourceHash
          ? "Source changed since last Compile. Run Compile before Deploy."
          : "Compiled artifacts are missing a source fingerprint. Run Compile again before Deploy.",
      };
    }
    return {
      canDeploy: true,
      needsCompile: false,
      usingBundled: false,
      reason: "Deploy using your compiled ZK artifacts",
    };
  }

  if (isDeployableTemplate(options.template)) {
    const baseline = getTemplateCompactSource(options.template);
    if (baseline && fingerprintSource(baseline) !== hash) {
      return {
        canDeploy: false,
        needsCompile: true,
        usingBundled: false,
        reason: "You edited the contract. Run Compile before Deploy (bundled assets no longer match).",
      };
    }
    return {
      canDeploy: true,
      needsCompile: false,
      usingBundled: true,
      reason: "Deploy using bundled Preprod assets (unedited template)",
    };
  }

  return {
    canDeploy: false,
    needsCompile: true,
    usingBundled: false,
    reason: "Run Compile to produce ZK keys, then Deploy.",
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
    return { label: "Ready to deploy", tone: "success" };
  }
  if (gate.canDeploy) {
    return { label: "Compiled · ready", tone: "success" };
  }
  if (gate.needsCompile) {
    return { label: "Needs Compile", tone: "warn" };
  }
  return { label: "Compile only", tone: "muted" };
}
