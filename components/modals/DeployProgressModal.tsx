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
    title: "Connect 1AM wallet",
    hint: "Unlock 1AM on Preprod and approve this site",
  },
  {
    id: "fees",
    title: "Check tDUST fees",
    hint: "Self-pay uses your Preprod tDUST — fund tNIGHT at the faucet if empty",
  },
  {
    id: "artifacts",
    title: "Prepare ZK artifacts",
    hint: "Loading compiled contract, keys and ZKIR",
  },
  {
    id: "providers",
    title: "Connect to Midnight Preprod",
    hint: "Indexer, wallet and contract providers",
  },
  {
    id: "prove",
    title: "Prove & submit in 1AM",
    hint: "ZK proof takes 1–2 min — approve in the 1AM wallet",
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
 * Full deploy progress: live stepper while the transaction is built/proven,
 * then a success card (address, explorer link, Contract panel) or an error card.
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={() => {
        if (!running) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-progress-title"
        className="relative w-full max-w-[480px] rounded-2xl p-5 space-y-4"
        style={{
          background: "#131313",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="deploy-progress-title"
              className="text-base font-semibold text-text-primary"
            >
              {succeeded
                ? "Contract deployed"
                : failed
                  ? "Deploy failed"
                  : "Deploying to Preprod"}
            </h2>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {projectName} · Midnight Preprod · {elapsed}
            </p>
          </div>
          {succeeded && (
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8.5L6.5 12L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          {failed && (
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-error/15 text-error flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </div>

        <ol className="space-y-2.5">
          {STEPS.map((step, i) => {
            const done = succeeded || i < active;
            const current = !succeeded && !failed && i === active;
            const errored = failed && i === active;
            return (
              <li key={step.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-2xs font-mono",
                    done && "bg-success/20 text-success",
                    current && "bg-accent/20 text-accent",
                    errored && "bg-error/20 text-error",
                    !done && !current && !errored && "bg-white/5 text-text-dim",
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
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm leading-5",
                      current || done ? "text-text-primary" : "text-text-muted",
                      errored && "text-error",
                    )}
                  >
                    {step.title}
                  </p>
                  {(current || errored) && (
                    <p className="text-xs text-text-muted mt-0.5">{step.hint}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {running && (
          <p className="text-xs text-text-muted leading-relaxed">
            Keep 1AM unlocked on Preprod. ZK proving usually takes 1–2 minutes. You can hide this
            and watch Network logs.
          </p>
        )}

        {succeeded && address && (
          <div
            className="rounded-lg p-3 space-y-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-2xs uppercase tracking-wide text-text-muted">Contract address</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-text-primary font-mono break-all flex-1">{address}</code>
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="text-2xs px-2 py-1 rounded border border-border/80 text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {txHash && (
              <p className="text-2xs text-text-muted font-mono break-all">Tx {txHash}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <a
                href={oneAmContractUrl(address)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline"
              >
                Contract on 1AM explorer ↗
              </a>
              {txHash && (
                <a
                  href={oneAmTxUrl(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Transaction ↗
                </a>
              )}
            </div>
          </div>
        )}

        {failed && (
          <div
            className="rounded-lg p-3"
            style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)" }}
          >
            <p className="text-xs text-error/90 leading-relaxed break-words">
              {result?.error ?? "Unknown error. Check the Network logs."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {running ? (
            <Button variant="ghost" size="md" onClick={onClose} title="Deploy continues in the background; watch Network logs.">
              Hide
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
                Close
              </Button>
              <Button variant="accent" size="md" onClick={onOpenContractUi}>
                Open Contract
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
