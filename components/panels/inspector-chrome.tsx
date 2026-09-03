"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Quiet uppercase section label used across inspector tabs. */
export function PanelSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 min-h-[18px]">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Collapsible one-line / short hint — replaces walls of info boxes. */
export function PanelHint({
  children,
  defaultOpen = false,
  label = "How this works",
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-border/70 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="text-2xs text-text-muted">{label}</span>
        <svg
          viewBox="0 0 12 12"
          className={cn(
            "w-3 h-3 text-text-dim transition-transform",
            open && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 text-2xs text-text-secondary leading-relaxed border-t border-border/50 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function PanelEmpty({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-8 h-8 rounded-full border border-border bg-white/[0.02] mb-3" />
      <p className="text-xs text-text-secondary">{title}</p>
      {detail && <p className="mt-1 text-2xs text-text-dim max-w-[220px] leading-relaxed">{detail}</p>}
    </div>
  );
}

export function PanelField({
  label,
  typeHint,
  tone = "neutral",
  children,
}: {
  label: string;
  typeHint?: string;
  tone?: "neutral" | "private" | "public";
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-2xs font-mono text-text-secondary truncate">{label}</span>
        {typeHint && (
          <span
            className={cn(
              "text-2xs font-mono truncate",
              tone === "private" && "text-warning",
              tone === "public" && "text-success",
              tone === "neutral" && "text-text-dim",
            )}
          >
            {typeHint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

export const panelInputClass =
  "w-full bg-[#0f0f0f] border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors";

export function PanelStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md bg-white/[0.03] border border-border/60 px-1 py-2 min-w-0">
      <span className="text-sm font-mono font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wide text-text-dim mt-0.5 truncate max-w-full">
        {label}
      </span>
    </div>
  );
}

export function PanelRowButton({
  onClick,
  children,
  tone = "default",
  className,
}: {
  onClick?: () => void;
  children: ReactNode;
  tone?: "default" | "warning" | "success" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 text-left rounded-md px-2.5 py-2 text-xs transition-colors border",
        tone === "default" && "border-transparent bg-white/[0.02] hover:bg-white/[0.05] hover:border-border",
        tone === "warning" && "border-warning/20 bg-warning/[0.06] hover:bg-warning/[0.1]",
        tone === "success" && "border-success/15 bg-success/[0.05] hover:bg-success/[0.08]",
        tone === "danger" && "border-error/20 bg-error/[0.05] hover:bg-error/[0.08]",
        className,
      )}
    >
      {children}
    </button>
  );
}
