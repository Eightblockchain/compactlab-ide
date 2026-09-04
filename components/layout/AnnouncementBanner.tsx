"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

type Announcement = {
  id: string;
  message: string;
  severity: "info" | "warning" | "critical";
  active: boolean;
};

type Health = {
  ok?: boolean;
  maintenance?: boolean;
  mode?: string;
  compileEnabled?: boolean;
};

/**
 * Shows active API announcements + maintenance from /v1/health.
 */
export function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`${API_BASE}/v1/catalog/announcements`)
        .then((r) => r.json())
        .then((j: { announcements?: Announcement[] }) => j.announcements ?? [])
        .catch(() => [] as Announcement[]),
      fetch(`${API_BASE}/v1/health`)
        .then((r) => r.json())
        .then((j: Health) => j)
        .catch(() => null),
    ]).then(([anns, h]) => {
      if (cancelled) return;
      setItems(anns.filter((a) => a.active));
      setHealth(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Array<{ id: string; message: string; tone: "info" | "warning" | "critical" }> = [];
  if (health?.maintenance) {
    rows.push({
      id: "maintenance",
      message: "CompactLab is in maintenance mode. Deploy and Call may be unavailable.",
      tone: "critical",
    });
  }
  if (health && health.ok === false) {
    rows.push({
      id: "api-down",
      message: "API health check failed. Cloud save and Compile may not work until the service recovers.",
      tone: "critical",
    });
  }
  for (const a of items) {
    if (!dismissed[a.id]) {
      rows.push({ id: a.id, message: a.message, tone: a.severity });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex-shrink-0">
      {rows.map((row) => (
        <div
          key={row.id}
          className={
            row.tone === "critical"
              ? "flex items-start gap-2 border-b border-error/25 bg-error/10 px-4 py-1.5 text-2xs text-error"
              : row.tone === "warning"
                ? "flex items-start gap-2 border-b border-warning/25 bg-warning/10 px-4 py-1.5 text-2xs text-warning"
                : "flex items-start gap-2 border-b border-border bg-surface-2 px-4 py-1.5 text-2xs text-text-secondary"
          }
        >
          <p className="flex-1 leading-relaxed">{row.message}</p>
          {row.id !== "maintenance" && row.id !== "api-down" && (
            <button
              type="button"
              className="text-text-dim hover:text-text-primary shrink-0"
              onClick={() => setDismissed((d) => ({ ...d, [row.id]: true }))}
            >
              Dismiss
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
