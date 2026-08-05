/**
 * Pure 1AM wallet detection (no React). Safe to import from client UI modules.
 */

import type { InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

export type DetectedWallet = {
  /** Injection key under window.midnight (usually a UUID). */
  id: string;
  api: InitialAPI;
};

export function isOneAmWallet(api: InitialAPI): boolean {
  const name = (api.name ?? "").toLowerCase();
  const rdns = String((api as { rdns?: string }).rdns ?? "").toLowerCase();
  return (
    name.includes("1am") ||
    name.includes("1 am") ||
    rdns.includes("1am") ||
    rdns.includes("oneam")
  );
}

/** All Midnight wallets that look like 1AM (v1 supported set). */
export function listMidnightWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];
  const midnight = window.midnight;
  if (!midnight) return [];
  return Object.entries(midnight)
    .filter(
      (entry): entry is [string, InitialAPI] =>
        !!entry[1] &&
        typeof entry[1] === "object" &&
        typeof (entry[1] as InitialAPI).connect === "function" &&
        isOneAmWallet(entry[1] as InitialAPI),
    )
    .map(([id, api]) => ({ id, api }));
}
