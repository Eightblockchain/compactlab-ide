"use client";

import { useEffect, useState } from "react";

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
    void fetch("/api/health")
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
      Public Preprod lab
      {status.compileEnabled === false ? (
        <span>
          {" "}
          · Instant Deploy (Hello / Counter) enabled · server Compile off (set{" "}
          <code className="text-text-secondary">COMPACTLAB_ENABLE_COMPILE</code> to allow)
        </span>
      ) : (
        <span> · Compile rate-limited · managed keys private under /api/zk</span>
      )}
    </div>
  );
}
