"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FEE_MODE, normalizeFeeMode, type FeeMode } from "@/lib/fee-mode";

export type UserSettings = {
  /** When false, witness values stay local and are not written to the API. */
  syncWitnessesToCloud: boolean;
  /** When false, skip auto-reconnect of 1AM after refresh. */
  walletRestoreEnabled: boolean;
  /** Used when sponsored fees are enabled; otherwise ignored. */
  defaultFeeMode: FeeMode;
  editorFontSize: number;
  editorTabSize: number;
  setSyncWitnessesToCloud: (value: boolean) => void;
  setWalletRestoreEnabled: (value: boolean) => void;
  setDefaultFeeMode: (mode: FeeMode) => void;
  setEditorFontSize: (size: number) => void;
  setEditorTabSize: (size: number) => void;
};

export const useUserSettings = create<UserSettings>()(
  persist(
    (set) => ({
      syncWitnessesToCloud: true,
      walletRestoreEnabled: true,
      defaultFeeMode: DEFAULT_FEE_MODE,
      editorFontSize: 13,
      editorTabSize: 2,
      setSyncWitnessesToCloud: (syncWitnessesToCloud) => set({ syncWitnessesToCloud }),
      setWalletRestoreEnabled: (walletRestoreEnabled) => set({ walletRestoreEnabled }),
      setDefaultFeeMode: (mode) => set({ defaultFeeMode: normalizeFeeMode(mode) }),
      setEditorFontSize: (editorFontSize) =>
        set({ editorFontSize: Math.min(20, Math.max(11, Math.round(editorFontSize))) }),
      setEditorTabSize: (editorTabSize) =>
        set({ editorTabSize: editorTabSize === 4 ? 4 : 2 }),
    }),
    {
      name: "compactlab-user-settings",
      version: 1,
      partialize: (s) => ({
        syncWitnessesToCloud: s.syncWitnessesToCloud,
        walletRestoreEnabled: s.walletRestoreEnabled,
        defaultFeeMode: s.defaultFeeMode,
        editorFontSize: s.editorFontSize,
        editorTabSize: s.editorTabSize,
      }),
    },
  ),
);

export function getUserSettingsSnapshot() {
  return useUserSettings.getState();
}
