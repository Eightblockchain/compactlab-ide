"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

type Status = {
  mode?: string;
  compileEnabled?: boolean;
};

/**
 * Subtle banner when the host runs in public product mode.
 */
export function PublicModeBanner() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${API_BASE}/v1/health`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setStatus(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || status.mode !== "public") return null;

  return (
    <div className="flex-shrink-0 border-b border-border bg-surface-2 px-4 py-1.5 text-2xs text-text-muted">
      Public Preprod lab · wallet: <span className="text-text-secondary">1AM only</span>
      {status.compileEnabled === false ? (
        <span>
          {" "}
          · server Compile off · only unedited Hello/Counter can Deploy (set{" "}
          <code className="text-text-secondary">COMPACTLAB_ENABLE_COMPILE=true</code>)
        </span>
      ) : (
        <span> · Compile then Deploy · Hello/Counter also ship bundled keys</span>
      )}
    </div>
  );
}
