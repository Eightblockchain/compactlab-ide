"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CompactLabLogo } from "@/components/brand/CompactLabLogo";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE, getToken } from "@/lib/api";
import { serverNow, useMaintenance } from "@/lib/maintenance";
import { subscribeUnsynced, unsyncedProjectIds } from "@/lib/project-sync";
import { cn } from "@/lib/utils";

type Announcement = { id: string; message: string; severity: "info" | "warning" | "critical"; updatedAt: string };

/** Projects with changes the cloud has not confirmed (kept on this device until it does). */
function useUnsyncedCount() {
  return useSyncExternalStore(
    subscribeUnsynced,
    () => unsyncedProjectIds().length,
    () => 0,
  );
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return "less than a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/**
 * Full-screen notice while the host is in maintenance (planned windows, pushed live
 * over WebSocket). It sits over the app instead of replacing it, so an open editor
 * keeps its state, and lifts by itself the moment maintenance ends. Afterwards a
 * short toast confirms the playground is back and work is synced.
 */
export function MaintenanceScreen() {
  const { maintenance } = useAuth();
  const [backAt, setBackAt] = useState<number | null>(null);
  const was = useRef(false);

  useEffect(() => {
    if (was.current && !maintenance) {
      const at = Date.now();
      queueMicrotask(() => setBackAt(at));
    }
    was.current = maintenance;
  }, [maintenance]);

  useEffect(() => {
    if (!backAt) return;
    const id = setTimeout(() => setBackAt(null), 6000);
    return () => clearTimeout(id);
  }, [backAt]);

  if (maintenance) return <MaintenanceDialog />;
  return backAt ? <BackToast onClose={() => setBackAt(null)} /> : null;
}

function MaintenanceDialog() {
  const { checkMaintenance } = useAuth();
  const current = useMaintenance((s) => s.status?.current ?? null);
  const connected = useMaintenance((s) => s.connected);
  const unsynced = useUnsyncedCount();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [now, setNow] = useState(() => serverNow());
  const [checking, setChecking] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    fetch(`${API_BASE.replace(/\/$/, "")}/v1/catalog/announcements`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { announcements?: Announcement[] } | null) => setAnnouncement(d?.announcements?.[0] ?? null))
      .catch(() => {});
    const id = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(id);
  }, []);

  // /v1/me fails during maintenance, so a stored session token is what says "signed in".
  const signedIn = Boolean(getToken());
  const start = current ? new Date(current.startsAt).getTime() : null;
  const end = current ? new Date(current.endsAt).getTime() : null;
  const progress = start && end ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : null;
  const overrun = end !== null && now >= end;
  const note = current?.message || announcement?.message || null;

  async function checkNow() {
    setChecking(true);
    await checkMaintenance();
    setChecking(false);
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      aria-describedby="maintenance-body"
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-background px-4 py-10 animate-fade-in"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(640px circle at 50% 0%, color-mix(in srgb, var(--color-warning) 10%, transparent), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-[480px]">
        <div className="mb-8 flex justify-center">
          <CompactLabLogo height={30} className="h-[30px] w-auto" />
        </div>

        <div className="rounded-xl border border-border bg-surface p-7 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.8)]">
          <span className="inline-flex items-center gap-2 rounded-full border border-warning/25 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
            <span className="size-1.5 rounded-full bg-warning status-pulse" aria-hidden />
            {current ? "Planned maintenance in progress" : "Maintenance in progress"}
          </span>

          <h1
            id="maintenance-title"
            ref={headingRef}
            tabIndex={-1}
            // Focused for screen readers on open; the global :focus-visible ring isn't wanted here.
            style={{ outline: "none" }}
            className="mt-4 text-2xl font-semibold tracking-tight text-text-primary"
          >
            {current && !overrun ? `Back by ${formatClock(current.endsAt)}` : "We'll be right back"}
          </h1>
          <p id="maintenance-body" className="mt-2 text-md leading-relaxed text-text-secondary">
            CompactLab is down for maintenance while we upgrade the playground. Sign-in, compiling and cloud saves are
            paused until it ends.
          </p>

          {current && end !== null && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-text-muted">
                  {formatClock(current.startsAt)} – {formatClock(current.endsAt)}
                </span>
                <span className="tabular-nums text-text-secondary">
                  {overrun ? "Finishing up" : `${formatDuration(end - now)} left`}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-warning/15"
                role="progressbar"
                aria-label="Maintenance progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress ?? 0)}
              >
                <div className="h-full rounded-full bg-warning transition-[width] duration-1000" style={{ width: `${progress ?? 0}%` }} />
              </div>
            </div>
          )}

          {note && (
            <div className="mt-5 rounded-lg border border-border bg-surface-2 px-4 py-3">
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Update from the team</p>
              <p className="mt-1 text-base text-text-primary">{note}</p>
            </div>
          )}

          <div className="mt-5 flex gap-3 rounded-lg border border-success/20 bg-success/[0.06] px-4 py-3">
            <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-success" aria-hidden fill="none">
              <path d="M8 1.5 2.5 3.5v4c0 3.3 2.3 5.9 5.5 7 3.2-1.1 5.5-3.7 5.5-7v-4L8 1.5Z" stroke="currentColor" strokeWidth="1.3" />
              <path d="m5.5 8 1.7 1.7L10.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm leading-relaxed text-text-secondary">
              {!signedIn
                ? "Your account and projects are safe."
                : unsynced > 0
                  ? `Your work is safe. ${unsynced === 1 ? "1 project is" : `${unsynced} projects are`} saved on this device and will sync to your account automatically when we're back.`
                  : "Your work is safe and fully saved to your account. Keep this tab open: your editor stays as you left it."}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
            <p className="flex items-center gap-2 text-sm text-text-muted" aria-live="polite">
              <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-text-dim")} aria-hidden />
              {checking ? "Checking status…" : connected ? "Live: this page reopens on its own" : "Reconnecting…"}
            </p>
            <button
              type="button"
              onClick={checkNow}
              disabled={checking}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white/[0.04] px-3 text-sm font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-white/[0.07] disabled:opacity-50"
            >
              {checking && (
                <span className="inline-block size-3 animate-spin rounded-full border border-current border-t-transparent" />
              )}
              Check now
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-text-muted">No need to refresh. Thanks for your patience.</p>
      </div>
    </div>
  );
}

function BackToast({ onClose }: { onClose: () => void }) {
  const unsynced = useUnsyncedCount();
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border-strong bg-surface-2 py-2.5 pr-2 pl-3.5 text-sm shadow-2xl animate-slide-up"
    >
      <span className="size-2 rounded-full bg-success" aria-hidden />
      <span className="text-text-primary">We&apos;re back.</span>
      <span className="text-text-secondary">
        {unsynced > 0 ? "Syncing your changes…" : "Your work is saved and synced."}
      </span>
      <button onClick={onClose} aria-label="Dismiss" className="ml-1 rounded px-1.5 text-text-muted hover:bg-white/[0.06] hover:text-text-primary">
        ×
      </button>
    </div>
  );
}
