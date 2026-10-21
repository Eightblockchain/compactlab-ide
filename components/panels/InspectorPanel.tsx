"use client";

import { useMemo } from "react";
import { useIDEStore } from "@/store/ide";
import { cn } from "@/lib/utils";
import type { PanelTab } from "@/store/ide";
import { PrivacyPanel } from "@/components/panels/PrivacyPanel";
import { ContractInteractPanel } from "@/components/panels/ContractInteractPanel";
import { analyzePrivacy } from "@/lib/compact-privacy";
import { lintCompactSource } from "@/lib/compact-lint";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "contract-ui", label: "Contract" },
  { id: "privacy", label: "Privacy" },
];

export function InspectorPanel() {
  const {
    rightPanelTab,
    setRightPanelTab,
    deployResult,
    compileResult,
    code,
    activeFile,
  } = useIDEStore();

  const privacyIssues = useMemo(() => {
    if (activeFile?.language !== "compact") return 0;
    return analyzePrivacy(code).flows.filter((f) => f.via.includes("missing")).length;
  }, [code, activeFile?.language]);

  const lintErrors = useMemo(() => {
    if (activeFile?.language !== "compact") return 0;
    return lintCompactSource(code).filter((d) => d.severity === "error").length;
  }, [code, activeFile?.language]);

  const status = useMemo(() => {
    if (deployResult?.success && deployResult.contractAddress) {
      return { label: "Deployed", tone: "success" as const };
    }
    if (compileResult && !compileResult.success) {
      return { label: "Compile errors", tone: "error" as const };
    }
    if (lintErrors > 0) {
      return { label: `${lintErrors} issue${lintErrors === 1 ? "" : "s"}`, tone: "warning" as const };
    }
    return null;
  }, [deployResult, compileResult, lintErrors]);

  return (
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      <div className="flex-shrink-0 h-9 flex items-stretch border-b border-border bg-background">
        <div className="flex items-stretch" role="tablist" aria-label="Inspector">
          {TABS.map((tab) => {
            const active = rightPanelTab === tab.id;
            const count = tab.id === "privacy" && privacyIssues > 0 ? privacyIssues : null;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRightPanelTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3.5 text-xs font-medium transition-colors",
                  active
                    ? "text-text-primary bg-surface"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                {tab.label}
                {count !== null && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-warning/15 text-warning text-[10px] font-mono leading-4 text-center">
                    {count}
                  </span>
                )}
                {active && <span className="absolute inset-x-0 top-0 h-px bg-accent" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        {status && (
          <div className="flex items-center pr-3">
            <StatusChip label={status.label} tone={status.tone} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {rightPanelTab === "contract-ui" && <ContractInteractPanel />}
        {rightPanelTab === "privacy" && <PrivacyPanel />}
      </div>
    </div>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "error";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 max-w-[140px] truncate text-2xs",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "error" && "text-error",
      )}
      title={label}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "error" && "bg-error",
        )}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
