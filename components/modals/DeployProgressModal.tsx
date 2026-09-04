"use client";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { DeployResult } from "@/lib/compact";
import type { DeployStage } from "@/lib/playground-deploy";
import { oneAmContractUrl, oneAmTxUrl } from "@/lib/explorers";

export type DeployUiStage = "connect" | "fees" | DeployStage;

type Props = {
  open: boolean;
  running: boolean;
  stage: DeployUiStage;
  startedAt: number;
  projectName: string;
  result: DeployResult | null;
  onClose: () => void;
  onOpenContractUi: () => void;
  onViewLogs: () => void;
};

const STEPS: Array<{ id: DeployUiStage; title: string; hint: string }> = [
  {
    id: "connect",
    title: "Connect 1AM",
    hint: "Unlock 1AM on Preprod and approve this site",
  },
  {
    id: "fees",
    title: "Confirm tDUST",
    hint: "Self-pay uses your Preprod tDUST. Fund tNIGHT at the faucet if empty.",
  },
  {
    id: "artifacts",
    title: "Load ZK artifacts",
    hint: "Compiled contract, prover keys, and ZKIR",
  },
  {
    id: "providers",
    title: "Reach Midnight Preprod",
    hint: "Indexer, wallet, and contract providers",
  },
  {
    id: "prove",
    title: "Prove and submit",
    hint: "ZK proving in 1AM usually takes 1 to 2 minutes. Approve when prompted.",
  },
];

function stageIndex(stage: DeployUiStage): number {
  return Math.max(0, STEPS.findIndex((s) => s.id === stage));
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

/**
 * Deploy progress: live stepper while the transaction is built and proven,
 * then a success card (address, explorer, Contract panel) or an error card.
 */
export function DeployProgressModal({
  open,
  running,
  stage,
  startedAt,
  projectName,
  result,
  onClose,
  onOpenContractUi,
  onViewLogs,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open, running]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const succeeded = Boolean(result?.success);
  const failed = Boolean(result && !result.success);
  const active = stageIndex(stage);
  const elapsed = formatElapsed(
    Math.max(0, (running ? now : startedAt + (result?.duration ?? 0)) - startedAt),
  );
  const address = result?.contractAddress ?? null;
  const txHash = result?.transactionHash ?? null;
  const progress = succeeded
    ? 100
    : failed
      ? Math.round(((active + 1) / STEPS.length) * 100)
      : Math.round(((active + (running ? 0.45 : 0)) / STEPS.length) * 100);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)" }}
      onClick={() => {
        if (!running) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-progress-title"
        className="relative w-full max-w-[560px] rounded-2xl p-6 sm:p-7 space-y-5"
        style={{
          background: "linear-gradient(180deg, #161616 0%, #111111 100%)",
          border: succeeded
            ? "1px solid rgba(52, 211, 153, 0.28)"
            : failed
              ? "1px solid rgba(244, 63, 94, 0.28)"
              : "1px solid rgba(233, 81, 68, 0.22)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-2xs uppercase tracking-[0.14em] text-accent/80 font-medium">
              On-chain deploy
            </p>
            <h2
              id="deploy-progress-title"
              className="text-lg font-semibold text-text-primary tracking-tight"
            >
              {succeeded
                ? "Your contract is live"
                : failed
                  ? "Deploy did not finish"
                  : "Deploying to Midnight Preprod"}
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {succeeded
                ? `${projectName} is published on Preprod. Save the address before you leave.`
                : failed
                  ? `${projectName} · ${elapsed}`
                  : `Publishing ${projectName}. This creates a permanent Preprod address.`}
            </p>
          </div>
          {succeeded && (
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8.5L6.5 12L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          {failed && (
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-error/15 text-error flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </div>

        {!succeeded && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-2xs text-text-muted">
              <span>{running ? "In progress" : failed ? "Stopped" : "Waiting"}</span>
              <span className="font-mono tabular-nums">{elapsed}</span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  failed ? "bg-error/70" : "bg-accent",
                )}
                style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
              />
            </div>
          </div>
        )}

        <ol className="space-y-3">
          {STEPS.map((step, i) => {
            const done = succeeded || i < active;
            const current = !succeeded && !failed && i === active;
            const errored = failed && i === active;
            return (
              <li key={step.id} className="flex items-start gap-3.5">
                <span
                  className={cn(
                    "mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-2xs font-mono",
                    done && "bg-success/20 text-success",
                    current && "bg-accent/20 text-accent ring-1 ring-accent/30",
                    errored && "bg-error/20 text-error",
                    !done && !current && !errored && "bg-white/[0.04] text-text-dim",
                  )}
                >
                  {done ? (
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2.5 6.5L5 9L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : current ? (
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
                      <path d="M10.5 6a4.5 4.5 0 00-4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ) : errored ? (
                    "!"
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p
                    className={cn(
                      "text-sm leading-5 font-medium",
                      current || done ? "text-text-primary" : "text-text-muted",
                      errored && "text-error",
                    )}
                  >
                    {step.title}
                  </p>
                  {(current || errored) && (
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{step.hint}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {running && (
          <p className="text-xs text-text-secondary leading-relaxed rounded-lg px-3 py-2.5 bg-accent/[0.06] border border-accent/15">
            Keep 1AM unlocked on Preprod. You can hide this dialog and follow Network logs; deploy
            continues in the background.
          </p>
        )}

        {succeeded && address && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "rgba(52, 211, 153, 0.05)", border: "1px solid rgba(52, 211, 153, 0.18)" }}
          >
            <p className="text-2xs uppercase tracking-[0.12em] text-success/90 font-medium">
              Contract address
            </p>
            <div className="flex items-start gap-2">
              <code className="text-sm text-text-primary font-mono break-all flex-1 leading-relaxed">
                {address}
              </code>
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="text-xs px-2.5 py-1.5 rounded-md border border-success/25 text-success hover:bg-success/10 transition-colors flex-shrink-0"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {txHash && (
              <p className="text-2xs text-text-muted font-mono break-all">Tx {txHash}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-0.5">
              <a
                href={oneAmContractUrl(address)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline"
              >
                View on 1AM explorer
              </a>
              {txHash && (
                <a
                  href={oneAmTxUrl(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  View transaction
                </a>
              )}
            </div>
          </div>
        )}

        {failed && (
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)" }}
          >
            <p className="text-sm text-error/90 leading-relaxed break-words">
              {result?.error ?? "Unknown error. Check the Network logs for details."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          {running ? (
            <Button
              variant="ghost"
              size="md"
              onClick={onClose}
              title="Deploy continues in the background. Watch Network logs."
            >
              Hide for now
            </Button>
          ) : failed ? (
            <>
              <Button variant="ghost" size="md" onClick={onClose}>
                Close
              </Button>
              <Button variant="default" size="md" onClick={onViewLogs}>
                View logs
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="md" onClick={onClose}>
                Done
              </Button>
              <Button variant="accent" size="lg" onClick={onOpenContractUi} className="px-5">
                Open Contract panel
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
