"use client";

import { useEffect, useState } from "react";
import { useLaceWallet, MIDNIGHT_WALLET_LINKS } from "@/hooks/useLaceWallet";
import { checkProofServerHealthy } from "@/lib/playground-deploy";
import { cn } from "@/lib/utils";

interface Checks {
  compact: boolean | null;
  proof: boolean | null;
  wallet: boolean | null;
}

/**
 * Beginner-first happy path: Open Hello → Connect wallet → Fund → Deploy → Call.
 */
export function OnboardingStrip() {
  const wallet = useLaceWallet();
  const [dismissed, setDismissed] = useState(false);
  const [checks, setChecks] = useState<Checks>({
    compact: null,
    proof: null,
    wallet: null,
  });

  useEffect(() => {
    try {
      if (localStorage.getItem("compactlab-onboarding-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      let compact: boolean | null = null;
      try {
        const res = await fetch("/api/compile", { method: "GET" });
        compact = res.ok;
      } catch {
        compact = false;
      }
      const proof = await checkProofServerHealthy();
      if (!cancelled) {
        setChecks({
          compact,
          proof,
          wallet: wallet.isInstalled || wallet.status === "connected",
        });
      }
    };
    void run();
    const id = setInterval(run, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [wallet.isInstalled, wallet.status]);

  if (dismissed) return null;

  const walletOk = wallet.status === "connected";
  const readyToDeploy = walletOk && checks.proof !== false;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("compactlab-onboarding-dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn(
        "flex-shrink-0 border-b px-4 py-2.5 flex flex-col gap-2 text-xs",
        readyToDeploy ? "bg-success/5 border-success/15" : "bg-surface-2 border-border",
      )}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-text-muted font-medium uppercase tracking-wide flex-shrink-0">
          Learn Compact
        </span>
        <span className="text-text-secondary">
          <span className="text-text-muted">1.</span> Open{" "}
          <span className="text-text-primary font-medium">Hello, Midnight!</span>
          <span className="text-text-dim mx-1.5">→</span>
          <span className="text-text-muted">2.</span> Connect wallet
          <span className="text-text-dim mx-1.5">→</span>
          <span className="text-text-muted">3.</span>{" "}
          <a
            href="https://faucet.preprod.midnight.network/"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Get free tDUST
          </a>
          <span className="text-text-dim mx-1.5">→</span>
          <span className="text-text-muted">4.</span>{" "}
          <span className="text-text-primary font-medium">Deploy</span>
          <span className="text-text-dim mx-1.5">→</span>
          <span className="text-text-muted">5.</span>{" "}
          <span className="text-text-primary font-medium">Call a circuit</span>
        </span>
        <div className="flex-1" />
        <button
          onClick={dismiss}
          className="text-text-dim hover:text-text-muted flex-shrink-0"
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-2xs text-text-dim uppercase tracking-wide flex-shrink-0">Needs</span>
        <Check
          ok={walletOk ? true : checks.wallet}
          label={
            walletOk
              ? `${wallet.connectedWalletName ?? "Wallet"} connected`
              : "Midnight wallet"
          }
          href={MIDNIGHT_WALLET_LINKS[0].href}
          onAction={!walletOk && checks.wallet ? () => void wallet.connect() : undefined}
        />
        <Check
          ok={checks.proof}
          label="Proof server"
          hint="Auto-starts on Deploy, or: docker run -p 6300:6300 midnightntwrk/proof-server"
        />
        <Check
          ok={checks.compact}
          label="Compact CLI"
          href="https://docs.midnight.network/"
          hint="Only needed to Compile your own edits"
        />
        {readyToDeploy && (
          <span className="text-success flex-shrink-0">Ready. Click Deploy</span>
        )}
      </div>
    </div>
  );
}

function Check({
  ok,
  label,
  href,
  hint,
  onAction,
}: {
  ok: boolean | null;
  label: string;
  href?: string;
  hint?: string;
  onAction?: () => void;
}) {
  const color =
    ok === true ? "text-success" : ok === false ? "text-error" : "text-text-dim";
  const dot =
    ok === true ? "bg-success" : ok === false ? "bg-error" : "bg-text-dim";

  const inner = (
    <span className={cn("flex items-center gap-1.5", color)} title={hint}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      {label}
      {ok === false && href ? " ↗" : ""}
      {onAction && ok !== true ? " (connect)" : ""}
    </span>
  );

  if (onAction && ok !== true) {
    return (
      <button type="button" onClick={onAction} className="hover:underline flex-shrink-0">
        {inner}
      </button>
    );
  }

  if (ok === false && href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="hover:underline flex-shrink-0">
        {inner}
      </a>
    );
  }
  return <span className="flex-shrink-0">{inner}</span>;
}
