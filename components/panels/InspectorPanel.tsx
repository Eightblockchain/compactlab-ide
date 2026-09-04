"use client";

import { useMemo, type ReactNode } from "react";
import { useIDEStore } from "@/store/ide";
import { Badge } from "@/components/ui";
import {
  extractCircuits,
  extractLedgerVars,
  extractWitnesses,
} from "@/lib/compact";
import { cn } from "@/lib/utils";
import type { PanelTab } from "@/store/ide";
import { LearnPanel } from "@/components/panels/LearnPanel";
import { PrivacyPanel } from "@/components/panels/PrivacyPanel";
import { ContractInteractPanel } from "@/components/panels/ContractInteractPanel";
import {
  PanelEmpty,
  PanelHint,
  PanelSection,
} from "@/components/panels/inspector-chrome";
import { analyzePrivacy } from "@/lib/compact-privacy";
import { lintCompactSource } from "@/lib/compact-lint";

const PRIMARY_TABS: {
  id: PanelTab;
  label: string;
  icon: ReactNode;
}[] = [
  {
    id: "contract-ui",
    label: "Contract",
    icon: (
      <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.35">
        <path d="M3 7h8M8 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="1.5" y="2.5" width="4" height="9" rx="1" opacity="0.45" />
      </svg>
    ),
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: (
      <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.35">
        <path d="M7 1.75l4.5 2v3.1c0 2.7-1.9 4.9-4.5 5.4-2.6-.5-4.5-2.7-4.5-5.4v-3.1L7 1.75z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const UTILITY_TABS: { id: PanelTab; label: string }[] = [
  { id: "source-scan", label: "Map" },
  { id: "learn", label: "Learn" },
];

export function InspectorPanel() {
  const {
    rightPanelTab,
    setRightPanelTab,
    deployResult,
    compileResult,
    code,
    activeFile,
    activeProject,
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
    if (privacyIssues > 0) {
      return { label: "Privacy hints", tone: "warning" as const };
    }
    if (activeProject) {
      return { label: activeProject.name, tone: "idle" as const };
    }
    return { label: "Idle", tone: "idle" as const };
  }, [deployResult, compileResult, lintErrors, privacyIssues, activeProject]);

  const title =
    rightPanelTab === "contract-ui"
      ? "Contract"
      : rightPanelTab === "privacy"
        ? "Privacy"
        : rightPanelTab === "source-scan"
          ? "Source map"
          : "Learn";

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border overflow-hidden">
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-dim">
              Inspector
            </p>
            <p className="text-sm font-medium text-text-primary truncate leading-tight mt-0.5">
              {title}
            </p>
          </div>
          <StatusChip label={status.label} tone={status.tone} />
        </div>

        <div className="px-3 pb-2">
          <div
            className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-[#0a0a0a] border border-border/80"
            role="tablist"
            aria-label="Inspector primary"
          >
            {PRIMARY_TABS.map((tab) => {
              const active = rightPanelTab === tab.id;
              const badge =
                tab.id === "privacy" && privacyIssues > 0
                  ? privacyIssues
                  : tab.id === "contract-ui" && deployResult?.success
                    ? "●"
                    : undefined;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRightPanelTab(tab.id)}
                  className={cn(
                    "relative flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all duration-150",
                    active
                      ? "bg-surface-2 text-text-primary shadow-[0_1px_0_rgba(255,255,255,0.04)]"
                      : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  <span className={cn(active ? "text-accent" : "opacity-70")}>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {badge !== undefined && (
                    <span
                      className={cn(
                        "absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 rounded-full text-[9px] font-mono leading-[14px] text-center",
                        typeof badge === "number"
                          ? "bg-warning/20 text-warning"
                          : "bg-success/20 text-success",
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 mt-1.5 px-0.5">
            {UTILITY_TABS.map((tab, i) => (
              <span key={tab.id} className="inline-flex items-center gap-1">
                {i > 0 && <span className="text-text-dim text-2xs">·</span>}
                <button
                  type="button"
                  onClick={() => setRightPanelTab(tab.id)}
                  className={cn(
                    "text-2xs transition-colors px-1 py-0.5 rounded",
                    rightPanelTab === tab.id
                      ? "text-text-primary bg-white/6"
                      : "text-text-dim hover:text-text-secondary",
                  )}
                >
                  {tab.label}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {rightPanelTab === "contract-ui" && <ContractInteractPanel />}
        {rightPanelTab === "privacy" && <PrivacyPanel />}
        {rightPanelTab === "source-scan" && <SourceScanTab />}
        {rightPanelTab === "learn" && <LearnPanel />}
      </div>
    </div>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "idle" | "success" | "warning" | "error";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 max-w-[140px] truncate rounded-full px-2 py-0.5 text-2xs border",
        tone === "success" && "border-success/25 bg-success/10 text-success",
        tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
        tone === "error" && "border-error/25 bg-error/10 text-error",
        tone === "idle" && "border-border bg-white/[0.03] text-text-muted",
      )}
      title={label}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "error" && "bg-error",
          tone === "idle" && "bg-white/25",
        )}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

function SourceScanTab() {
  const { code } = useIDEStore();
  const ledgerVars = extractLedgerVars(code);
  const witnesses = extractWitnesses(code);
  const circuits = extractCircuits(code);

  return (
    <div className="p-4 space-y-5 animate-[fade-in_0.15s_ease-out]">
      <PanelHint label="About this map">
        Regex scan of your Compact text, not compiler analysis. Ledger is public on-chain;
        witnesses stay off-chain inside proofs.
      </PanelHint>

      <div className="grid grid-cols-3 gap-1.5">
        <MiniCount label="Ledger" value={ledgerVars.length} color="#7dba84" />
        <MiniCount label="Witness" value={witnesses.length} color="#d4a853" />
        <MiniCount label="Circuit" value={circuits.length} color="#F06358" />
      </div>

      <PanelSection title="Public ledger">
        {ledgerVars.length === 0 ? (
          <PanelEmpty title="No ledger fields" detail="Declare export ledger … to store public state." />
        ) : (
          <div className="space-y-1">
            {ledgerVars.map((v) => (
              <ScanRow key={v.name} name={v.name} type={v.type} badge="public" />
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Witnesses">
        {witnesses.length === 0 ? (
          <p className="text-2xs text-text-dim px-0.5">None declared.</p>
        ) : (
          <div className="space-y-1">
            {witnesses.map((w) => (
              <ScanRow key={w.name} name={w.name} type={w.type} badge="private" />
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Circuits">
        {circuits.length === 0 ? (
          <PanelEmpty title="No circuits" detail="Add export circuit name(): [] { … }" />
        ) : (
          <div className="space-y-1">
            {circuits.map((c) => (
              <div
                key={c.name}
                className="rounded-md border border-border/70 bg-white/[0.02] px-2.5 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-primary">{c.name}()</span>
                  {c.isExported && (
                    <Badge variant="success" size="sm">
                      export
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.inputs.length === 0 ? (
                    <span className="text-2xs text-text-dim">No parameters</span>
                  ) : (
                    c.inputs.map((i) => (
                      <span
                        key={i.name}
                        className="text-2xs font-mono text-text-secondary bg-white/[0.04] px-1.5 py-0.5 rounded"
                      >
                        {i.name}: <span className="text-warning/90">{i.type}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </div>
  );
}

function MiniCount({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-white/[0.02] px-2 py-2 text-center">
      <p className="text-sm font-mono font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-wide text-text-dim mt-0.5">{label}</p>
    </div>
  );
}

function ScanRow({
  name,
  type,
  badge,
}: {
  name: string;
  type: string;
  badge: "public" | "private";
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-white/[0.02] px-2.5 py-2">
      <span
        className={cn(
          "w-1 h-1 rounded-full shrink-0",
          badge === "public" ? "bg-success" : "bg-warning",
        )}
      />
      <span className="text-xs font-mono text-text-primary truncate flex-1">{name}</span>
      <span
        className={cn(
          "text-2xs font-mono truncate max-w-[45%]",
          badge === "public" ? "text-success/80" : "text-warning/80",
        )}
      >
        {type}
      </span>
    </div>
  );
}
