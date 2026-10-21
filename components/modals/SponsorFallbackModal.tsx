"use client";

import { Button } from "@/components/ui";
import { useEffect } from "react";

export type SponsorFallbackChoice = "self" | "cancel";

type Props = {
  open: boolean;
  reason: string;
  syncing: boolean;
  onChoose: (choice: SponsorFallbackChoice) => void;
};

/**
 * Ask before paying Deploy/Call fees from the user's tDUST when Sponsored
 * was selected but the API sponsor is not healthy yet.
 */
export function SponsorFallbackModal({ open, reason, syncing, onChoose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChoose("cancel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onChoose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={() => onChoose("cancel")}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sponsor-fallback-title"
        className="relative w-full max-w-[440px] rounded-xl p-5 space-y-4"
        style={{
          background: "#121215",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <h2
            id="sponsor-fallback-title"
            className="text-base font-semibold text-text-primary"
          >
            Sponsored fees not ready
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {syncing
              ? "CompactLab’s fee sponsor is still syncing Dust with Preprod."
              : "CompactLab’s fee sponsor is unavailable right now."}
          </p>
          <p className="text-xs text-text-muted leading-relaxed break-words">
            {reason}
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            You have tDUST in 1AM. Deploy with Self-pay for this transaction, or
            cancel and wait for Sponsored.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={() => onChoose("cancel")}>
            Cancel
          </Button>
          <Button variant="accent" size="md" onClick={() => onChoose("self")}>
            Deploy with Self-pay
          </Button>
        </div>
      </div>
    </div>
  );
}
