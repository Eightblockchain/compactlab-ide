/**
 * Indexer endpoints for the Midnight SDK, per network.
 *
 * - Preview: Midnight's free public indexer, direct.
 * - Preprod with the user's own Blockfrost key: Blockfrost, direct.
 * - Preprod otherwise: the CompactLab API proxy. Midnight retired
 *   indexer.preprod.midnight.network on 2026-10-09; Blockfrost hosts it now and
 *   needs a project token, which stays on the API. The API hands out a
 *   short-lived ticket, proxies GraphQL HTTP and WebSocket traffic, and meters
 *   it against a daily quota shared by all users.
 */

import type { NetworkInfo } from "@/lib/network";
import { getActiveNetwork } from "@/lib/user-settings";
import { getOwnBlockfrostKey, ownKeyEndpoints } from "@/lib/own-blockfrost-key";

export type IndexerEndpoints = { indexerUri: string; indexerWsUri: string };

export type IndexerSource = "public" | "own-key" | "compactlab";

export const INDEXER_NOT_CONFIGURED_MESSAGE =
  "CompactLab can't reach the Preprod indexer: this server has no Blockfrost token configured. Add your own free Blockfrost key in Settings, or switch to the Preview network.";

/** Refresh the ticket this long before it expires. */
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

let cached: (IndexerEndpoints & { expiresAt: number }) | null = null;
let inflight: Promise<IndexerEndpoints> | null = null;

export function indexerSource(network: NetworkInfo = getActiveNetwork()): IndexerSource {
  if (network.publicIndexer) return "public";
  return getOwnBlockfrostKey() ? "own-key" : "compactlab";
}

export async function getIndexerEndpoints(network: NetworkInfo = getActiveNetwork()): Promise<IndexerEndpoints> {
  if (network.publicIndexer) {
    return { indexerUri: network.publicIndexer.http, indexerWsUri: network.publicIndexer.ws };
  }
  const ownKey = getOwnBlockfrostKey();
  if (ownKey) return ownKeyEndpoints(ownKey);

  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached;
  inflight ??= fetchProxyEndpoints().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function fetchProxyEndpoints(): Promise<IndexerEndpoints> {
  const { apiFetch } = await import("@/lib/api");
  const res = await apiFetch("/v1/indexer/ticket", { method: "GET" });
  if (res.status === 503) throw new Error(INDEXER_NOT_CONFIGURED_MESSAGE);
  if (res.status === 401) throw new Error("Sign in again to reach the Preprod indexer.");
  if (!res.ok) throw new Error(`Could not reach the Preprod indexer proxy (HTTP ${res.status}).`);
  const body = (await res.json()) as { httpUrl: string; wsUrl: string; expiresAt: number };
  cached = { indexerUri: body.httpUrl, indexerWsUri: body.wsUrl, expiresAt: body.expiresAt };
  return cached;
}

export type SharedIndexerStatus =
  | { ok: true }
  | { ok: false; code: string; message: string; resetsAt?: number };

/** Can this user reach CompactLab's shared Preprod indexer right now? */
export async function fetchSharedIndexerStatus(): Promise<SharedIndexerStatus | null> {
  try {
    const { apiFetch } = await import("@/lib/api");
    const res = await apiFetch("/v1/indexer/status", { method: "GET" });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      configured: boolean;
      ok: boolean;
      code?: string;
      message?: string;
      resetsAt?: number;
    };
    if (!body.configured) return { ok: false, code: "INDEXER_NOT_CONFIGURED", message: INDEXER_NOT_CONFIGURED_MESSAGE };
    if (body.ok) return { ok: true };
    return { ok: false, code: body.code ?? "INDEXER_LIMIT", message: body.message ?? "", resetsAt: body.resetsAt };
  } catch {
    return null;
  }
}

const LIMIT_CODES = [
  "INDEXER_DAILY_LIMIT",
  "INDEXER_USER_DAILY_LIMIT",
  "INDEXER_UPSTREAM_LIMIT",
  "INDEXER_UPSTREAM_BUSY",
] as const;

const LIMIT_HINT =
  "CompactLab's shared Preprod indexer allowance is used up for today (resets 00:00 UTC). Add your own free Blockfrost key in Settings, or switch to the Preview network.";

/**
 * Turn an indexer quota failure into a readable message, or null if `err` is
 * something else. HTTP limits arrive as GraphQL errors with a readable message;
 * WebSocket limits arrive as close code 4402 with the limit code as reason.
 */
export function explainIndexerLimit(err: unknown): string | null {
  const text =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : err && typeof err === "object"
          ? `${(err as { code?: unknown }).code ?? ""} ${(err as { reason?: unknown }).reason ?? ""}`
          : "";
  if (/indexer allowance/i.test(text)) return text;
  if (/INDEXER_UPSTREAM_BUSY/.test(text)) return "The Preprod indexer is busy. Try again in a few seconds.";
  if (LIMIT_CODES.some((code) => text.includes(code)) || /\b4402\b/.test(text)) return LIMIT_HINT;
  return null;
}

/** One GraphQL query against the network's indexer (same route the SDK uses). */
export async function queryIndexerGraphql<T>(
  query: string,
  network: NetworkInfo = getActiveNetwork(),
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const { indexerUri } = await getIndexerEndpoints(network);
  const res = await fetch(indexerUri, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20_000),
  });
  return (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
}
