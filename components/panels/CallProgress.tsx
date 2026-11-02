"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CallStage } from "@/lib/playground-call";

export type CallUiStage = "connect" | CallStage;

const STEPS: Array<{ id: CallUiStage; title: string; hint: (sponsored: boolean) => string }> = [
  { id: "connect", title: "Connect 1AM", hint: () => "Approve in 1AM if it asks." },
  { id: "join", title: "Load the contract", hint: () => "Reading the contract and its current state." },
  {
    id: "prove",
    title: "Prove in 1AM",
    hint: () => "Approve proving in 1AM. The proof usually takes 1 to 2 minutes.",
  },
  {
    id: "balance",
    title: "Add the network fee",
    hint: (sponsored) => (sponsored ? "CompactLab pays this fee." : "Approve the tDUST fee in 1AM."),
  },
  { id: "submit", title: "Send to Midnight", hint: () => "Submitting the transaction." },
  { id: "confirm", title: "Wait for confirmation", hint: () => "Waiting for the transaction to land in a block." },
];

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

/** Live steps of a running Call, shown under the Send button. */
export function CallProgress({
  circuit,
  stage,
  startedAt,
  sponsored,
  note,
}: {
  circuit: string;
  stage: CallUiStage;
  startedAt: number;
  sponsored: boolean;
  /** Shown above the steps, e.g. while 1AM reconnects mid-call. */
  note?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = Math.max(0, STEPS.findIndex((s) => s.id === stage));

  return (
    <div className="rounded-md border border-accent/25 bg-accent/[0.05] p-2.5 space-y-2" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-text-primary">
          Running <span className="font-mono">{circuit}()</span>
        </p>
        <span className="text-2xs font-mono text-text-muted tabular-nums">{formatElapsed(now - startedAt)}</span>
      </div>
      {note && <p className="text-2xs text-warning leading-relaxed">{note}</p>}
      <ol className="space-y-1.5">
        {STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={step.id} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-px w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-mono",
                  done && "bg-success/20 text-success",
                  current && "bg-accent/20 text-accent ring-1 ring-accent/30",
                  !done && !current && "bg-white/[0.04] text-text-dim",
                )}
              >
                {done ? (
                  <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2.5 6.5L5 9L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : current ? (
                  <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
                    <path d="M10.5 6a4.5 4.5 0 00-4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("text-xs leading-4", current || done ? "text-text-primary" : "text-text-muted")}>
                  {step.title}
                </p>
                {current && <p className="text-2xs text-text-muted leading-relaxed mt-0.5">{step.hint(sponsored)}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
