"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FEE_MODE, normalizeFeeMode, type FeeMode } from "@/lib/fee-mode";
import {
  DEFAULT_NETWORK,
  NETWORKS,
  normalizeNetwork,
  type NetworkInfo,
  type PlaygroundNetwork,
} from "@/lib/network";

export type UserSettings = {
  /** When false, witness values stay local and are not written to the API. */
  syncWitnessesToCloud: boolean;
  /** When false, skip auto-reconnect of 1AM after refresh. */
  walletRestoreEnabled: boolean;
  /** Used when sponsored fees are enabled; otherwise ignored. */
  defaultFeeMode: FeeMode;
  editorFontSize: number;
  editorTabSize: number;
  /** Midnight network for Deploy, Call and ledger reads (see lib/network.ts). */
  network: PlaygroundNetwork;
  setSyncWitnessesToCloud: (value: boolean) => void;
  setWalletRestoreEnabled: (value: boolean) => void;
  setDefaultFeeMode: (mode: FeeMode) => void;
  setEditorFontSize: (size: number) => void;
  setEditorTabSize: (size: number) => void;
  setNetwork: (network: PlaygroundNetwork) => void;
};

export const useUserSettings = create<UserSettings>()(
  persist(
    (set) => ({
      syncWitnessesToCloud: true,
      walletRestoreEnabled: true,
      defaultFeeMode: DEFAULT_FEE_MODE,
      editorFontSize: 13,
      editorTabSize: 2,
      network: DEFAULT_NETWORK,
      setSyncWitnessesToCloud: (syncWitnessesToCloud) => set({ syncWitnessesToCloud }),
      setWalletRestoreEnabled: (walletRestoreEnabled) => set({ walletRestoreEnabled }),
      setDefaultFeeMode: (mode) => set({ defaultFeeMode: normalizeFeeMode(mode) }),
      setEditorFontSize: (editorFontSize) =>
        set({ editorFontSize: Math.min(20, Math.max(11, Math.round(editorFontSize))) }),
      setEditorTabSize: (editorTabSize) =>
        set({ editorTabSize: editorTabSize === 4 ? 4 : 2 }),
      setNetwork: (network) => set({ network: normalizeNetwork(network) }),
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
        network: s.network,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UserSettings>;
        return { ...current, ...p, network: normalizeNetwork(p.network) };
      },
    },
  ),
);

export function getUserSettingsSnapshot() {
  return useUserSettings.getState();
}

/** Network chosen in Settings, for code outside React. */
export function getActiveNetwork(): NetworkInfo {
  return NETWORKS[normalizeNetwork(useUserSettings.getState().network)];
}

/** Network chosen in Settings, as a React hook. */
export function useActiveNetwork(): NetworkInfo {
  return NETWORKS[normalizeNetwork(useUserSettings((s) => s.network))];
}

const OPEN_SETTINGS_EVENT = "compactlab:open-settings";

/** Ask the Topbar to open Settings (e.g. from a notice's "Use your own key" action). */
export function requestOpenSettings(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

export function onOpenSettingsRequest(handler: () => void): () => void {
  window.addEventListener(OPEN_SETTINGS_EVENT, handler);
  return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
}
