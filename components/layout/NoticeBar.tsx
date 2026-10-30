"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { API_BASE, createBrowserApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import { MIDNIGHT_WALLET_LINKS } from "@/lib/wallet-links";
import { useIDEStore } from "@/store/ide";
import { getDeployGate, getLiveCompactSource } from "@/lib/deploy-gate";
import { cn } from "@/lib/utils";
import { requestOpenSettings, useActiveNetwork, useUserSettings } from "@/lib/user-settings";
import { useOwnBlockfrostKey } from "@/lib/own-blockfrost-key";
import { fetchSharedIndexerStatus, type SharedIndexerStatus } from "@/lib/indexer-endpoints";
import { serverNow, useMaintenance, type MaintenanceWindow } from "@/lib/maintenance";
import { formatClock, formatDuration } from "@/components/layout/MaintenanceScreen";

/**
 * One slim bar under the Topbar. Replaces the separate public-mode,
 * announcement, workspace and onboarding banners: it shows the single most
 * important message, highest priority first:
 *   outage → unconfirmed email → indexer allowance → workspace sync → announcements → server limits → next step.
 */

type Tone = "critical" | "warning" | "info" | "guide";

type Notice = {
  id: string;
  tone: Tone;
  content: ReactNode;
  /** Dismissible notices hide until reload (announcements, workspace) or for good (guide). */
  onDismiss?: () => void;
};

type Health = { ok?: boolean; maintenance?: boolean; mode?: string; compileEnabled?: boolean };
type Announcement = { id: string; message: string; severity: "info" | "warning" | "critical"; active: boolean };

const GUIDE_DISMISSED_KEY = "compactlab-onboarding-dismissed";
/** How often to re-check the shared Preprod indexer allowance. */
const INDEXER_STATUS_POLL_MS = 5 * 60 * 1000;

export function NoticeBar() {
  const wallet = useLaceWallet();
  const { user, refresh } = useAuth();
  const unverifiedEmail = user && user.emailVerified === false ? user.email : null;
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | { error: string }>("idle");

  // Pick up a confirmation made in another tab (the email link) when the user comes back.
  useEffect(() => {
    if (!unverifiedEmail) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [unverifiedEmail, refresh]);
  const {
    activeProject,
    activeFileId,
    code,
    tabBuffers,
    workspaceNotice,
    setWorkspaceNotice,
  } = useIDEStore();

  const [health, setHealth] = useState<Health | null>(null);
  const [compilerMissing, setCompilerMissing] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  // The playground renders client-side only (after mount), so localStorage is safe here.
  const [guideDismissed, setGuideDismissed] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [index, setIndex] = useState(0);
  const network = useActiveNetwork();
  const setNetwork = useUserSettings((s) => s.setNetwork);
  const ownKey = useOwnBlockfrostKey();
  const usesSharedIndexer = !network.publicIndexer && !ownKey;
  const [indexerStatus, setIndexerStatus] = useState<SharedIndexerStatus | null>(null);

  useEffect(() => {
    if (!usesSharedIndexer) return;
    let cancelled = false;
    const check = () =>
      void fetchSharedIndexerStatus().then((s) => {
        if (!cancelled) setIndexerStatus(s);
      });
    check();
    const id = setInterval(check, INDEXER_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [usesSharedIndexer]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`${API_BASE}/v1/health`)
        .then((r) => r.json() as Promise<Health>)
        .catch(() => null),
      fetch(`${API_BASE}/v1/catalog/announcements`)
        .then((r) => r.json() as Promise<{ announcements?: Announcement[] }>)
        .then((j) => (j.announcements ?? []).filter((a) => a.active))
        .catch(() => [] as Announcement[]),
      import("@/lib/api")
        .then(({ apiFetch }) => apiFetch("/v1/compile", { method: "GET" }))
        .then((r) => r.json() as Promise<{ available?: boolean; compileEnabled?: boolean }>)
        .then((b) => b.compileEnabled !== false && b.available === false)
        .catch(() => false),
    ]).then(([h, anns, missing]) => {
      if (cancelled) return;
      setHealth(h);
      setAnnouncements(anns);
      setCompilerMissing(missing);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const walletConnected = wallet.status === "connected";

  const planned = useMaintenance((s) => s.status?.upcoming[0] ?? null);
  // Re-evaluate tone as the start approaches (the text itself ticks inside PlannedMaintenance).
  const [toneTick, setToneTick] = useState(0);
  useEffect(() => {
    if (!planned) return;
    const id = setInterval(() => setToneTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [planned]);

  const notices = useMemo<Notice[]>(() => {
    const out: Notice[] = [];
    if (planned && !dismissed[`planned-${planned.id}`]) {
      const startsIn = new Date(planned.startsAt).getTime() - serverNow();
      const soon = startsIn < 60 * 60_000;
      out.push({
        id: `planned-${planned.id}`,
        tone: startsIn < 5 * 60_000 ? "critical" : soon ? "warning" : "info",
        content: <PlannedMaintenance window={planned} />,
        // Can be hidden while it is far off; within the hour it stays visible.
        onDismiss: soon ? undefined : () => setDismissed((d) => ({ ...d, [`planned-${planned.id}`]: true })),
      });
    }
    if (health && health.ok === false) {
      out.push({
        id: "api-down",
        tone: "critical",
        content: "The CompactLab API is not responding. Cloud save and Compile may fail until it recovers.",
      });
    }
    if (unverifiedEmail) {
      const sendAgain = () => {
        setResend("sending");
        createBrowserApi()
          .resendVerification()
          .then((r) => (r.alreadyVerified ? void refresh() : setResend("sent")))
          .catch((e) => setResend({ error: e instanceof Error ? e.message : "Could not send" }));
      };
      out.push({
        id: "email-unverified",
        tone: "warning",
        content: (
          <>
            Confirm your email to deploy and call. We sent a link to{" "}
            <span className="mx-1 font-medium">{unverifiedEmail}</span>
            {resend === "sent" ? (
              <span className="ml-1 text-text-muted">New link sent. Check spam too.</span>
            ) : resend === "sending" ? (
              <span className="ml-1 text-text-muted">Sending…</span>
            ) : (
              <>
                {typeof resend === "object" && <span className="ml-1 text-error">{resend.error}</span>}
                <span className="ml-2">
                  <InlineAction onClick={sendAgain}>Resend email</InlineAction>
                </span>
              </>
            )}
          </>
        ),
      });
    }
    if (usesSharedIndexer && indexerStatus && !indexerStatus.ok) {
      out.push({
        id: "indexer-limit",
        tone: "warning",
        content: (
          <>
            {indexerStatus.code === "INDEXER_NOT_CONFIGURED"
              ? "This server has no Preprod indexer configured."
              : "Today's shared Preprod indexer allowance is used up (resets 00:00 UTC)."}{" "}
            <InlineAction onClick={requestOpenSettings}>Use your own Blockfrost key</InlineAction>
            <span className="mx-1.5 text-text-muted">or</span>
            <InlineAction onClick={() => setNetwork("preview")}>Switch to Preview</InlineAction>
          </>
        ),
      });
    }
    if (workspaceNotice) {
      out.push({
        id: "workspace",
        tone: "warning",
        content: workspaceNotice,
        onDismiss: () => setWorkspaceNotice(null),
      });
    }
    for (const a of announcements) {
      if (dismissed[a.id]) continue;
      out.push({
        id: a.id,
        tone: a.severity,
        content: a.message,
        onDismiss: () => setDismissed((d) => ({ ...d, [a.id]: true })),
      });
    }
    if (health?.compileEnabled === false && !dismissed["compile-off"]) {
      out.push({
        id: "compile-off",
        tone: "info",
        content: "Server Compile is off on this host. Only unedited Hello World and Counter can Deploy.",
        onDismiss: () => setDismissed((d) => ({ ...d, "compile-off": true })),
      });
    }
    if (compilerMissing) {
      out.push({
        id: "compiler-missing",
        tone: "warning",
        content: "The Compact compiler is not available on the server, so Compile will fail.",
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toneTick re-evaluates the countdown tone
  }, [
    planned,
    toneTick,
    health,
    unverifiedEmail,
    resend,
    refresh,
    usesSharedIndexer,
    indexerStatus,
    setNetwork,
    workspaceNotice,
    setWorkspaceNotice,
    announcements,
    dismissed,
    compilerMissing,
  ]);

  const guide = useMemo<Notice | null>(() => {
    if (guideDismissed || !activeProject) return null;
    const dismissGuide = () => {
      setGuideDismissed(true);
      try {
        localStorage.setItem(GUIDE_DISMISSED_KEY, "1");
      } catch {
        /* ignore */
      }
    };

    let step: ReactNode;
    if (!walletConnected && !wallet.isInstalled) {
      step = (
        <>
          Install the{" "}
          <a href={MIDNIGHT_WALLET_LINKS[0].href} target="_blank" rel="noreferrer" className="text-text-primary underline decoration-white/25 underline-offset-2 hover:decoration-white/60">
            1AM wallet
          </a>{" "}
          to deploy. It is the only supported wallet.
        </>
      );
    } else if (!walletConnected) {
      step = (
        <>
          Connect 1AM to deploy on {network.label}.{" "}
          <InlineAction onClick={() => void wallet.connect()}>Connect</InlineAction>
        </>
      );
    } else if (gate.needsCompile) {
      step = <>Run <Strong>Compile</Strong> to generate ZK keys, then Deploy.</>;
    } else if (gate.canDeploy) {
      step = <>Ready to <Strong>Deploy</Strong>. This publishes a permanent {network.label} address.</>;
    } else {
      return null;
    }

    return {
      id: "guide",
      tone: "guide",
      content: (
        <>
          <span className="text-text-muted">Next step</span>
          <span className="mx-2 h-3 w-px bg-border-strong" aria-hidden />
          <span>{step}</span>
          <a href={network.faucetUrl} target="_blank" rel="noreferrer" className="ml-3 text-text-muted hover:text-text-primary">
            Get tDUST ↗
          </a>
        </>
      ),
      onDismiss: dismissGuide,
    };
  }, [guideDismissed, activeProject, walletConnected, wallet, gate.needsCompile, gate.canDeploy, network]);

  const queue = notices.length > 0 ? notices : guide ? [guide] : [];
  if (queue.length === 0) return null;

  const current = queue[Math.min(index, queue.length - 1)]!;

  return (
    <div
      role={current.tone === "critical" ? "alert" : "status"}
      className={cn(
        "flex-shrink-0 flex items-center gap-2.5 h-8 px-3 border-b text-xs",
        current.tone === "critical" && "bg-error/[0.08] border-error/20 text-text-primary",
        current.tone === "warning" && "bg-warning/[0.06] border-warning/15 text-text-primary",
        (current.tone === "info" || current.tone === "guide") && "bg-surface border-border text-text-secondary",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          current.tone === "critical" && "bg-error",
          current.tone === "warning" && "bg-warning",
          current.tone === "info" && "bg-info",
          current.tone === "guide" && "bg-accent",
        )}
      />
      <div className="flex-1 min-w-0 flex items-center truncate">{current.content}</div>

      {queue.length > 1 && (
        <button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % queue.length)}
          className="flex-shrink-0 rounded px-1.5 h-5 text-2xs font-mono text-text-muted hover:text-text-primary hover:bg-white/[0.06]"
          title="Next notice"
        >
          {Math.min(index, queue.length - 1) + 1}/{queue.length} ›
        </button>
      )}
      {current.onDismiss && (
        <button
          type="button"
          onClick={() => {
            current.onDismiss?.();
            setIndex(0);
          }}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-white/[0.06]"
          title="Dismiss"
          aria-label="Dismiss notice"
        >
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2 2l6 6M8 2L2 8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <span className="text-text-primary font-medium">{children}</span>;
}

/** "Planned maintenance Fri, Oct 24, 14:00 – 15:00 (1 h) · starts in 42 min. Your work is saved automatically." */
function PlannedMaintenance({ window: w }: { window: MaintenanceWindow }) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(id);
  }, []);
  const start = new Date(w.startsAt);
  const startsIn = start.getTime() - now;
  const day = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const length = formatDuration(new Date(w.endsAt).getTime() - start.getTime());
  const countdown =
    startsIn <= 0
      ? "starting now"
      : startsIn < 60 * 60_000
        ? `starts in ${startsIn < 60_000 ? `${Math.ceil(startsIn / 1000)} s` : formatDuration(startsIn)}`
        : null;
  return (
    <span className="truncate">
      <span className="font-medium">Planned maintenance</span> {day}, {formatClock(w.startsAt)} – {formatClock(w.endsAt)} ({length})
      {countdown && <span className="tabular-nums"> · {countdown}</span>}
      <span className="text-text-muted">
        {" "}
        · {w.message ? `${w.message} ` : ""}Your work is saved automatically before it starts.
      </span>
    </span>
  );
}

function InlineAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-1 rounded px-1.5 h-5 text-2xs font-medium text-text-primary bg-white/[0.06] border border-border hover:bg-white/[0.1]"
    >
      {children}
    </button>
  );
}
