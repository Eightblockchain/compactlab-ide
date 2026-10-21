"use client";

import { useState } from "react";
import { useIDEStore } from "@/store/ide";
import { extractCircuits, extractLedgerVars, extractWitnesses } from "@/lib/compact";
import { cn } from "@/lib/utils";

/**
 * Source scan of the open .compact file: ledger fields, witnesses and circuits.
 * A regex scan, not compiler analysis. Shown as a collapsible section in Privacy.
 */
export function ContractStructure() {
  const code = useIDEStore((s) => s.code);
  const [open, setOpen] = useState(true);
  const ledgerVars = extractLedgerVars(code);
  const witnesses = extractWitnesses(code);
  const circuits = extractCircuits(code);

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 min-h-[18px] text-left group"
        aria-expanded={open}
      >
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted whitespace-nowrap group-hover:text-text-secondary">
          Contract structure
        </h3>
        <span className="flex items-center text-text-dim">
          <svg
            viewBox="0 0 12 12"
            className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          <Group label="Ledger" empty="No ledger fields">
            {ledgerVars.map((v) => (
              <Row
                key={v.name}
                name={v.name}
                detail={v.type}
                tag={v.isExported ? "export" : "not exported"}
                tone={v.isExported ? "public" : "muted"}
              />
            ))}
          </Group>
          <Group label="Witnesses" empty="None declared">
            {witnesses.map((w) => (
              <Row key={w.name} name={w.name} detail={w.type} tag="private" tone="private" />
            ))}
          </Group>
          <Group label="Circuits" empty="No circuits">
            {circuits.map((c) => (
              <Row
                key={c.name}
                name={`${c.name}()`}
                detail={
                  c.inputs.length === 0
                    ? "no parameters"
                    : c.inputs.map((i) => `${i.name}: ${i.type}`).join(", ")
                }
                tag={c.isExported ? "export" : undefined}
                tone="public"
              />
            ))}
          </Group>
        </div>
      )}
    </section>
  );
}

function Group({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <div className="px-2.5 py-2 space-y-1">
      <p className="text-2xs text-text-muted">{label}</p>
      {children.length === 0 ? <p className="text-2xs text-text-dim">{empty}</p> : children}
    </div>
  );
}

function Row({
  name,
  detail,
  tag,
  tone,
}: {
  name: string;
  detail: string;
  tag?: string;
  tone: "public" | "private" | "muted";
}) {
  return (
    <div className="flex items-baseline gap-2 min-w-0 text-xs">
      <span className="font-mono text-text-primary flex-shrink-0">{name}</span>
      <span className="font-mono text-2xs text-text-muted truncate flex-1" title={detail}>
        {detail}
      </span>
      {tag && (
        <span
          className={cn(
            "text-[10px] flex-shrink-0",
            tone === "public" && "text-success/80",
            tone === "private" && "text-warning/80",
            tone === "muted" && "text-text-dim",
          )}
        >
          {tag}
        </span>
      )}
    </div>
  );
}
