"use client";

import { useEffect } from "react";
import { useIDEStore } from "@/store/ide";
import { LearnPanel } from "@/components/panels/LearnPanel";

/** Slide-over with Learn topics. Opened from the Topbar help button. */
export function HelpDrawer() {
  const open = useIDEStore((s) => s.helpOpen);
  const setOpen = useIDEStore((s) => s.setHelpOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="help-drawer-title">
      <div className="absolute inset-0 bg-black/50 animate-[fade-in_0.15s_ease-out]" onClick={() => setOpen(false)} />
      <aside className="absolute right-0 top-0 h-full w-[420px] max-w-[92vw] flex flex-col bg-surface border-l border-border-strong shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.8)] animate-[slide-up_0.18s_ease-out]">
        <header className="flex-shrink-0 h-11 flex items-center justify-between px-4 border-b border-border">
          <h2 id="help-drawer-title" className="text-sm font-medium text-text-primary">
            Learn Compact
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.06]"
            aria-label="Close help"
          >
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M2 2l6 6M8 2L2 8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="flex-1 min-h-0 pt-3">
          <LearnPanel />
        </div>
      </aside>
    </div>
  );
}
