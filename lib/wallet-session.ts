/**
 * Detect / probe 1AM (DApp Connector) session expiry.
 * getConnectionStatus() is the API's intended liveness check.
 */

import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

export const WALLET_SESSION_EXPIRED_MSG =
  "1AM connection expired — reconnect to continue.";

export function serializeWalletErr(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { reason?: unknown; message?: unknown; code?: unknown };
    if (typeof e.reason === "string" && e.reason.trim()) return e.reason;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
    if (typeof e.code === "string" && e.code.trim()) return e.code;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function isWalletSessionExpiredMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("connection expired") ||
    lower.includes("please reconnect") ||
    lower.includes("connection to the wallet was lost") ||
    lower.includes("wallet was lost") ||
    (lower.includes("disconnected") &&
      (lower.includes("reconnect") || lower.includes("connection")))
  );
}

export function isWalletSessionExpiredError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; reason?: unknown; message?: unknown };
    if (e.code === "Disconnected") return true;
    if (typeof e.reason === "string" && isWalletSessionExpiredMessage(e.reason)) {
      return true;
    }
    if (typeof e.message === "string" && isWalletSessionExpiredMessage(e.message)) {
      return true;
    }
  }
  return isWalletSessionExpiredMessage(serializeWalletErr(err));
}

export type WalletProbeResult =
  | { ok: true; networkId?: string }
  | { ok: false; reason: "expired" | "wrong-network" | "unreachable"; detail: string };

export async function probeWalletSession(
  api: ConnectedAPI,
  targetNetwork = "preprod",
): Promise<WalletProbeResult> {
  if (typeof api.getConnectionStatus === "function") {
    try {
      const cs = await api.getConnectionStatus();
      if (cs.status === "disconnected") {
        return { ok: false, reason: "expired", detail: WALLET_SESSION_EXPIRED_MSG };
      }
      if (cs.status === "connected") {
        if (cs.networkId && cs.networkId !== targetNetwork) {
          return {
            ok: false,
            reason: "wrong-network",
            detail: `Connected to network "${cs.networkId}" but CompactLab expects ${targetNetwork}. Switch to Preprod in 1AM.`,
          };
        }
        return { ok: true, networkId: cs.networkId };
      }
    } catch (err) {
      if (isWalletSessionExpiredError(err)) {
        return { ok: false, reason: "expired", detail: WALLET_SESSION_EXPIRED_MSG };
      }
      // Fall through to a lightweight address probe.
    }
  }

  try {
    await api.getUnshieldedAddress();
    return { ok: true };
  } catch (err) {
    if (isWalletSessionExpiredError(err)) {
      return { ok: false, reason: "expired", detail: WALLET_SESSION_EXPIRED_MSG };
    }
    return {
      ok: false,
      reason: "unreachable",
      detail: serializeWalletErr(err) || WALLET_SESSION_EXPIRED_MSG,
    };
  }
}
