"use client";

import { useSyncExternalStore } from "react";

/**
 * A user's own Blockfrost project id for Midnight Preprod.
 *
 * With it, the browser talks to Blockfrost directly and skips CompactLab's
 * shared daily quota. The key is stored only in this browser (localStorage) and
 * sent only to Blockfrost, never to the CompactLab API or project sync.
 * Blockfrost allows browser requests from any origin.
 */

export const BLOCKFROST_PREPROD_BROWSER = {
  http: "https://midnight-preprod.blockfrost.io/api/v0",
  ws: "wss://midnight-preprod.blockfrost.io/api/v0/ws",
} as const;

export const BLOCKFROST_SIGNUP_URL = "https://blockfrost.io/";

const STORAGE_KEY = "compactlab-own-blockfrost-preprod";
const CHANGE_EVENT = "compactlab:own-blockfrost-key";

/** Midnight Preprod project ids start with "nightpreprod". */
export function isPlausibleBlockfrostKey(value: string): boolean {
  return /^nightpreprod[A-Za-z0-9]{8,64}$/.test(value.trim());
}

export function getOwnBlockfrostKey(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)?.trim();
    return value && isPlausibleBlockfrostKey(value) ? value : null;
  } catch {
    return null;
  }
}

export function setOwnBlockfrostKey(value: string | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the key simply isn't remembered.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useOwnBlockfrostKey(): string | null {
  return useSyncExternalStore(subscribe, getOwnBlockfrostKey, () => null);
}

export function ownKeyEndpoints(key: string): { indexerUri: string; indexerWsUri: string } {
  const q = `project_id=${encodeURIComponent(key)}`;
  return {
    indexerUri: `${BLOCKFROST_PREPROD_BROWSER.http}?${q}`,
    indexerWsUri: `${BLOCKFROST_PREPROD_BROWSER.ws}?${q}`,
  };
}

/** Ask Blockfrost for the latest block height with this key. */
export async function testBlockfrostKey(
  key: string,
): Promise<{ ok: true; height: number } | { ok: false; message: string }> {
  if (!isPlausibleBlockfrostKey(key)) {
    return { ok: false, message: 'That does not look like a Midnight Preprod project id (it starts with "nightpreprod").' };
  }
  try {
    const res = await fetch(ownKeyEndpoints(key.trim()).indexerUri, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { block { height } }" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, message: "Blockfrost rejected this project id." };
    if (res.status === 402) return { ok: false, message: "This Blockfrost project is over its daily limit." };
    if (!res.ok) return { ok: false, message: `Blockfrost answered HTTP ${res.status}.` };
    const body = (await res.json()) as { data?: { block?: { height?: number } } };
    const height = body.data?.block?.height;
    return typeof height === "number" ? { ok: true, height } : { ok: false, message: "Unexpected reply from Blockfrost." };
  } catch {
    return { ok: false, message: "Could not reach Blockfrost from this browser." };
  }
}
