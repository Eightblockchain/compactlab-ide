"use client";

import { useIDEStore } from "@/store/ide";

/** Thin banner for cloud sync / hydrate failures. */
export function WorkspaceNoticeBanner() {
  const workspaceNotice = useIDEStore((s) => s.workspaceNotice);
  const setWorkspaceNotice = useIDEStore((s) => s.setWorkspaceNotice);

  if (!workspaceNotice) return null;

  return (
    <div className="flex-shrink-0 border-b border-warning/25 bg-warning/8 px-4 py-2 flex items-start gap-3 text-xs text-text-secondary">
      <span className="flex-1 leading-relaxed">{workspaceNotice}</span>
      <button
        type="button"
        onClick={() => setWorkspaceNotice(null)}
        className="text-text-muted hover:text-text-primary flex-shrink-0"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
