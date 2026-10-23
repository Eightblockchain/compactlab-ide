"use client";

import { create } from "zustand";
import { API_BASE, MAINTENANCE_EVENT } from "@/lib/api";

/**
 * Live maintenance status from the API. A WebSocket (/v1/status/ws) pushes every
 * change: an admin plans, edits or ends a window, or a window starts or ends on
 * its own. While the socket is down, GET /v1/status/maintenance is polled.
 */

export type MaintenanceWindow = { id: string; startsAt: string; endsAt: string; message: string | null };

export type MaintenanceStatus = {
  active: boolean;
  current: MaintenanceWindow | null;
  upcoming: MaintenanceWindow[];
  serverTime: string;
};

type State = {
  status: MaintenanceStatus | null;
  /** serverTime − local clock, applied to countdowns. */
  offsetMs: number;
  connected: boolean;
};

export const useMaintenance = create<State>(() => ({ status: null, offsetMs: 0, connected: false }));

/** Local "now" corrected to the API clock. */
export function serverNow(): number {
  return Date.now() + useMaintenance.getState().offsetMs;
}

const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;
const base = API_BASE.replace(/\/$/, "");

function apply(status: MaintenanceStatus) {
  useMaintenance.setState({ status, offsetMs: new Date(status.serverTime).getTime() - Date.now() });
}

/** One-off read; also used by "Check now" and after a 503 from any user route. */
export async function refetchMaintenance(): Promise<MaintenanceStatus | null> {
  try {
    const res = await fetch(`${base}/v1/status/maintenance`, { cache: "no-store" });
    if (!res.ok) return null;
    const status = (await res.json()) as MaintenanceStatus;
    apply(status);
    return status;
  } catch {
    return null;
  }
}

let started = false;

/** Opens the status socket once per tab and keeps it open. */
export function connectMaintenance() {
  if (started || typeof window === "undefined") return;
  started = true;

  let backoff = 1000;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const startPolling = () => {
    if (pollTimer) return;
    void refetchMaintenance();
    pollTimer = setInterval(() => void refetchMaintenance(), POLL_MS);
  };
  const stopPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  const open = () => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${base.replace(/^http/, "ws")}/v1/status/ws`);
    } catch {
      startPolling();
      setTimeout(open, backoff);
      return;
    }
    ws.onopen = () => {
      backoff = 1000;
      stopPolling();
      useMaintenance.setState({ connected: true });
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data)) as { type?: string } & MaintenanceStatus;
        if (msg.type === "maintenance") apply(msg);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      useMaintenance.setState({ connected: false });
      startPolling();
      setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    };
  };

  open();
  // A user route answered 503 "Maintenance mode": confirm right away.
  window.addEventListener(MAINTENANCE_EVENT, () => void refetchMaintenance());
  // Laptops waking up: the socket may be stale.
  window.addEventListener("online", () => void refetchMaintenance());
}
