"use client";

import { useMemo, useState } from "react";
import { useIDEStore } from "@/store/ide";
import { analyzePrivacy, type PrivacyKind } from "@/lib/compact-privacy";
import { compactEditorBridge } from "@/lib/compact-editor-bridge";
import { cn } from "@/lib/utils";
import {
  PanelEmpty,
  PanelHint,
  PanelRowButton,
  PanelSection,
} from "@/components/panels/inspector-chrome";
import { ContractStructure } from "@/components/panels/ContractStructure";

const KIND_META: Record<PrivacyKind, { label: string; swatch: string; chip: string }> = {
  private: {
    label: "Private",
    swatch: "#d4a853",
    chip: "bg-warning/15 text-warning border-warning/20",
  },
  public: {
    label: "Public",
    swatch: "#7dba84",
    chip: "bg-success/15 text-success border-success/20",
  },
  disclose: {
    label: "Disclose",
    swatch: "#F06358",
    chip: "bg-accent/15 text-accent border-accent/25",
  },
  hash: {
    label: "Hash",
    swatch: "#95CF98",
    chip: "bg-white/6 text-text-secondary border-border",
  },
};

export function PrivacyPanel() {
  const { code, activeFile } = useIDEStore();
  const [filter, setFilter] = useState<PrivacyKind | "all">("all");

  const analysis = useMemo(
    () =>
      activeFile?.language === "compact"
        ? analyzePrivacy(code)
        : { spans: [], flows: [], summary: { private: 0, public: 0, disclose: 0, hash: 0 } },
    [code, activeFile?.language],
  );

  const uniqueFlows = analysis.flows.filter(
    (f, i, arr) =>
      arr.findIndex((x) => x.from === f.from && x.to === f.to && x.via === f.via && x.line === f.line) === i,
  );

  const spans = dedupeSpans(analysis.spans).filter(
    (s) => filter === "all" || s.kind === filter,
  );

  if (activeFile?.language !== "compact") {
    return (
      <div className="p-3">
        <PanelEmpty title="Open a .compact file" detail="Privacy analysis runs on Compact source." />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 animate-[fade-in_0.15s_ease-out]">
      <PanelHint label="Reading this view">
        Witnesses and circuit args stay private. Ledger is public.{" "}
        <span className="font-mono text-accent">disclose()</span> is an intentional leak. Hashes hide
        preimages but stay witness-tainted until disclosed. Spans highlight in the editor while this
        tab is open. Click a row to jump.
      </PanelHint>

      <div className="grid grid-cols-4 gap-1">
        {(Object.keys(KIND_META) as PrivacyKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter((prev) => (prev === k ? "all" : k))}
            className={cn(
              "flex flex-col items-center justify-center rounded-md border px-1 py-2 transition-colors min-w-0",
              filter === k
                ? "border-accent/40 bg-accent/10"
                : "border-border/60 bg-white/[0.02] hover:bg-white/[0.04]",
            )}
          >
            <span
              className="text-sm font-mono font-semibold tabular-nums"
              style={{ color: KIND_META[k].swatch }}
            >
              {analysis.summary[k]}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-text-dim mt-0.5 truncate max-w-full">
              {KIND_META[k].label}
            </span>
          </button>
        ))}
      </div>

      <PanelSection
        title="Data flow"
        action={
          uniqueFlows.some((f) => f.via.includes("missing")) ? (
            <span className="text-2xs text-warning">needs disclose?</span>
          ) : undefined
        }
      >
        {uniqueFlows.length === 0 ? (
          <p className="text-2xs text-text-dim px-0.5">No witness → ledger paths detected.</p>
        ) : (
          <div className="space-y-1">
            {uniqueFlows.map((f, i) => (
              <PanelRowButton
                key={`${f.line}-${i}`}
                onClick={() => compactEditorBridge.jumpTo(f.line)}
                tone={f.via.includes("missing") ? "warning" : "default"}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-text-primary truncate">
                    {f.from} <span className="text-text-dim">→</span> {f.to}
                  </p>
                  <p className="text-2xs text-text-muted mt-0.5">
                    L{f.line} · {f.via}
                  </p>
                </div>
              </PanelRowButton>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection
        title="Spans"
        action={
          filter !== "all" ? (
            <button
              type="button"
              className="text-2xs text-accent hover:underline"
              onClick={() => setFilter("all")}
            >
              Clear filter
            </button>
          ) : (
            <span className="text-2xs text-text-dim">{spans.length}</span>
          )
        }
      >
        {spans.length === 0 ? (
          <PanelEmpty title="Nothing to show" detail="Adjust the filter or add witnesses / ledger fields." />
        ) : (
          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-0.5">
            {spans.map((s, i) => (
              <PanelRowButton
                key={`${s.line}:${s.column}:${i}`}
                onClick={() => compactEditorBridge.jumpTo(s.line, s.column)}
              >
                <span
                  className={cn(
                    "text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 mt-0.5",
                    KIND_META[s.kind].chip,
                  )}
                >
                  {KIND_META[s.kind].label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-text-primary">{s.name}</span>
                  <span className="text-text-dim"> · L{s.line}</span>
                  <p className="text-2xs text-text-muted leading-snug mt-0.5 line-clamp-2">{s.note}</p>
                </span>
              </PanelRowButton>
            ))}
          </div>
        )}
      </PanelSection>

      <ContractStructure />
    </div>
  );
}

function dedupeSpans<T extends { line: number; column: number; name: string; kind: string }>(spans: T[]): T[] {
  const seen = new Set<string>();
  return spans.filter((s) => {
    const k = `${s.kind}:${s.name}:${s.line}:${s.column}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
