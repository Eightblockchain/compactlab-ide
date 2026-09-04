"use client";

import { useEffect, useState } from "react";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import { MIDNIGHT_WALLET_LINKS } from "@/lib/wallet-links";
import { useIDEStore } from "@/store/ide";
import { getDeployGate, getLiveCompactSource } from "@/lib/deploy-gate";
import { cn } from "@/lib/utils";

interface Checks {
  compact: boolean | null;
  compileEnabled: boolean | null;
  wallet: boolean | null;
}

/**
 * Flow: project → Connect 1AM → Compile (unless bundled Hello/Counter) → Deploy → Call.
 */
export function OnboardingStrip() {
  const wallet = useLaceWallet();
  const { activeProject, activeFileId, code, tabBuffers, setNewProjectModalOpen, loadProject, projects } =
    useIDEStore();
  const [dismissed, setDismissed] = useState(false);
  const [checks, setChecks] = useState<Checks>({
    compact: null,
    compileEnabled: null,
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
      let compileEnabled: boolean | null = null;
      try {
        const { apiFetch } = await import("@/lib/api");
        const res = await apiFetch("/v1/compile", { method: "GET" });
        const body = (await res.json().catch(() => ({}))) as {
          available?: boolean;
          compileEnabled?: boolean;
        };
        compileEnabled = body.compileEnabled ?? true;
        compact = compileEnabled === false ? true : res.ok && body.available !== false;
      } catch {
        compact = false;
        compileEnabled = null;
      }
      if (!cancelled) {
        setChecks({
          compact,
          compileEnabled,
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
  const liveSource = getLiveCompactSource({
    files: activeProject?.files ?? [],
    activeFileId,
    code,
    tabBuffers,
  });
  const gate = getDeployGate({
    template: activeProject?.template ?? "",
    artifactBaseUrl: activeProject?.artifactBaseUrl,
    compiledSourceHash: activeProject?.compiledSourceHash,
    currentSource: liveSource,
  });
  const readyToDeploy = walletOk && gate.canDeploy;
  const needsCompile = gate.needsCompile;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("compactlab-onboarding-dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  const openHello = () => {
    const hello = projects.find((p) => p.template === "hello-world");
    if (hello) loadProject(hello.id);
    else setNewProjectModalOpen(true, "hello-world");
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
          Get started
        </span>
        <span className="text-text-secondary">
          <button type="button" onClick={openHello} className="text-accent hover:underline font-medium">
            Hello World
          </button>
          <span className="text-text-dim mx-1">or</span>
          <button
            type="button"
            onClick={() => setNewProjectModalOpen(true, "blank")}
            className="text-accent hover:underline font-medium"
          >
            New project
          </button>
          <span className="text-text-dim mx-1.5">→</span>
          <span className="text-text-primary font-medium">Connect 1AM</span>
          <span className="text-text-dim mx-1.5">→</span>
          {needsCompile || !gate.usingBundled ? (
            <>
              <span className="text-text-primary font-medium">Compile</span>
              <span className="text-text-dim mx-1.5">→</span>
            </>
          ) : null}
          <span className="text-text-primary font-medium">Deploy</span>
          <span className="text-text-dim mx-1.5">→</span>
          <span className="text-text-primary font-medium">Call</span>
          <span className="text-text-dim mx-1.5">·</span>
          <a
            href="https://faucet.preprod.midnight.network/"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            tDUST faucet
          </a>
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
          label={walletOk ? "1AM connected" : "1AM wallet only"}
          href={MIDNIGHT_WALLET_LINKS[0].href}
          onAction={!walletOk && checks.wallet ? () => void wallet.connect() : undefined}
          hint="Lace and other Midnight wallets are not supported in CompactLab v1"
        />
        <Check
          ok={
            checks.compileEnabled === false
              ? gate.usingBundled
              : needsCompile
                ? checks.compact
                : true
          }
          label={
            checks.compileEnabled === false
              ? gate.usingBundled
                ? "Bundled keys OK"
                : "Compile disabled"
              : needsCompile
                ? "Compile required"
                : gate.usingBundled
                  ? "Bundled or Compile"
                  : "Compiled"
          }
          href="https://docs.midnight.network/"
          hint={
            checks.compileEnabled === false
              ? "Server Compile is off. Use unedited Hello/Counter, or set COMPACTLAB_ENABLE_COMPILE=true."
              : needsCompile
                ? "Run Compile (full ZK), then Deploy. Typecheck alone does not prepare Deploy."
                : "Hello/Counter can Deploy with bundled keys. Other projects need Compile first."
          }
        />
        {readyToDeploy && (
          <span className="text-success flex-shrink-0 font-medium">
            Ready for Deploy. Publishing creates a permanent Preprod address.
          </span>
        )}
        {!readyToDeploy && walletOk && needsCompile && (
          <span className="text-warning flex-shrink-0">Run Compile, then Deploy</span>
        )}
        {!walletOk && (
          <span className="text-text-muted flex-shrink-0">Connect 1AM in the toolbar to deploy</span>
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

  return (
    <span className={cn("inline-flex items-center gap-1.5", color)} title={hint}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />
      {onAction ? (
        <button type="button" onClick={onAction} className="hover:underline">
          {label}
        </button>
      ) : href && ok !== true ? (
        <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
          {label}
        </a>
      ) : (
        label
      )}
    </span>
  );
}
