"use client";

import { useEffect } from "react";
import { serverNow, useMaintenance } from "@/lib/maintenance";
import { flushProjectSync, setProjectSyncPaused } from "@/lib/project-sync";
import { useIDEStore } from "@/store/ide";

/** Seconds before a planned window starts at which open work is saved to the cloud. */
const SAVE_BEFORE_START_S = [60, 5];

/** Put unsaved typing into the (locally persisted) project and push everything pending. */
function saveWork() {
  useIDEStore.getState().flushEditorBuffer();
  void flushProjectSync();
}

/**
 * Keeps users' work safe around maintenance and tab closes. Renders nothing.
 * - Before a planned window: saves at T−60s and T−5s while the API still accepts it.
 * - During maintenance: cloud saves pause (they would 503); edits stay in local storage.
 * - After: saves resume and every unconfirmed project is pushed (lib/project-sync).
 * - Tab hidden or closed: unsaved typing is written to local storage right away.
 */
export function WorkSafety() {
  useEffect(() => {
    let timers: Array<ReturnType<typeof setTimeout>> = [];
    let plannedStart: string | null = null;
    let wasActive = false;

    const onStatus = () => {
      const status = useMaintenance.getState().status;
      if (!status) return;

      if (status.active !== wasActive) {
        wasActive = status.active;
        if (status.active) {
          useIDEStore.getState().flushEditorBuffer();
          setProjectSyncPaused(true);
        } else {
          setProjectSyncPaused(false);
        }
      }

      const next = status.upcoming[0]?.startsAt ?? null;
      if (next === plannedStart) return;
      plannedStart = next;
      timers.forEach(clearTimeout);
      timers = [];
      if (!next) return;
      const startsIn = new Date(next).getTime() - serverNow();
      for (const s of SAVE_BEFORE_START_S) {
        const delay = startsIn - s * 1000;
        if (delay > 0 && delay < 2 ** 31 - 1) timers.push(setTimeout(saveWork, delay));
      }
    };

    onStatus();
    const unsubscribe = useMaintenance.subscribe(onStatus);
    const onHide = () => {
      if (document.visibilityState === "hidden") saveWork();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", saveWork);
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", saveWork);
    };
  }, []);

  return null;
}
