"use client";

/**
 * CompactLab v1 wallet: 1AM only (delegated ZK proving via getProvingProvider).
 *
 * Spec still uses window.midnight UUID keys — we filter to 1AM by name/rdns.
 * https://docs.midnight.network/guides/react-wallet-connect
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import type { ConnectionStatus, WalletInfo } from "@/lib/hello-midnight/types";
import {
  isOneAmWallet,
  listMidnightWallets,
  type DetectedWallet,
} from "@/lib/wallet-detect";
import { readDustBalance, type DustBalanceInfo } from "@/lib/dust-balance";
import { getActiveNetwork, getUserSettingsSnapshot, useUserSettings } from "@/lib/user-settings";
import {
  clearWalletRestorePreference,
  readWalletRestorePreference,
  writeWalletRestorePreference,
} from "@/lib/wallet-restore";
import {
  isWalletSessionExpiredError,
  probeWalletSession,
  serializeWalletErr,
  WALLET_SESSION_EXPIRED_MSG,
} from "@/lib/wallet-session";

export type { DetectedWallet } from "@/lib/wallet-detect";
export { isOneAmWallet, listMidnightWallets } from "@/lib/wallet-detect";
/** v1 install link — CompactLab requires 1AM for wallet-side proving. */
export { MIDNIGHT_WALLET_LINKS } from "@/lib/wallet-links";
export { clearWalletRestorePreference as clearRestorePreferenceForSettings } from "@/lib/wallet-restore";
export {
  isWalletSessionExpiredError,
  isWalletSessionExpiredMessage,
  WALLET_SESSION_EXPIRED_MSG,
} from "@/lib/wallet-session";

export interface UseMidnightWalletReturn {
  availableWallets: DetectedWallet[];
  isInstalled: boolean;
  status: ConnectionStatus;
  error: string | null;
  connectedAPI: ConnectedAPI | null;
  walletInfo: WalletInfo | null;
  connectedWalletName: string | null;
  /** Live tDUST from getDustBalance(); null if unavailable. */
  dustBalance: DustBalanceInfo | null;
  refreshDustBalance: () => Promise<DustBalanceInfo | null>;
  connectTo: (wallet: DetectedWallet) => Promise<ConnectedAPI | null>;
  connect: () => Promise<ConnectedAPI | null>;
  disconnect: () => void;
  /**
   * Probe the live 1AM session. Returns the API if still valid; otherwise clears
   * local "connected" state so the UI can prompt Reconnect.
   */
  ensureSession: () => Promise<ConnectedAPI | null>;
  /** Mark the session expired (e.g. after Deploy/Call gets "Connection expired"). */
  markSessionExpired: (detail?: string) => void;
  /** Re-scan window.midnight after installing/enabling 1AM. */
  refreshWallets: () => void;
}

/** @deprecated Use UseMidnightWalletReturn */
export type UseLaceWalletReturn = UseMidnightWalletReturn;

const MidnightWalletContext = createContext<UseMidnightWalletReturn | null>(null);

/** 1AM connections are per network: always the one chosen in Settings. */
const targetNetwork = () => getActiveNetwork().id;
/** Silent auto-restore must not block the UI if 1AM waits for approval. */
const SILENT_CONNECT_TIMEOUT_MS = 8_000;
/** How often to ask 1AM whether the DApp connection is still alive. */
const SESSION_POLL_MS = 12_000;

async function assertUsableConnection(api: ConnectedAPI): Promise<void> {
  if (typeof api.getProvingProvider !== "function") {
    throw new Error(
      "Connected wallet does not support getProvingProvider(). CompactLab v1 requires 1AM (https://1am.xyz/).",
    );
  }

  let last: Awaited<ReturnType<typeof probeWalletSession>> | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
    last = await probeWalletSession(api, targetNetwork());
    if (last.ok || last.reason === "wrong-network") break;
  }

  if (last && !last.ok) {
    if (last.reason === "wrong-network") throw new Error(last.detail);
    console.warn(
      `[compactlab] Wallet session probe after connect(): ${last.detail}; continuing if address APIs work.`,
    );
  }
}

function useMidnightWalletState(): UseMidnightWalletReturn {
  const [availableWallets, setAvailableWallets] = useState<DetectedWallet[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [connectedWalletName, setConnectedWalletName] = useState<string | null>(null);
  const [dustBalance, setDustBalance] = useState<DustBalanceInfo | null>(null);
  const connectGeneration = useRef(0);

  const refreshWallets = useCallback(() => {
    setAvailableWallets(listMidnightWallets());
  }, []);

  const clearSessionLocal = useCallback((message: string | null, nextStatus: ConnectionStatus) => {
    connectGeneration.current += 1;
    setConnectedAPI(null);
    setWalletInfo(null);
    setConnectedWalletName(null);
    setDustBalance(null);
    setError(message);
    setStatus(nextStatus);
  }, []);

  const markSessionExpired = useCallback(
    (detail?: string) => {
      clearSessionLocal(detail?.trim() || WALLET_SESSION_EXPIRED_MSG, "error");
    },
    [clearSessionLocal],
  );

  const ensureSession = useCallback(async (): Promise<ConnectedAPI | null> => {
    const api = connectedAPI;
    if (!api || status !== "connected") return null;
    const probe = await probeWalletSession(api, targetNetwork());
    if (probe.ok) return api;
    clearSessionLocal(
      probe.reason === "wrong-network" ? probe.detail : WALLET_SESSION_EXPIRED_MSG,
      "error",
    );
    return null;
  }, [clearSessionLocal, connectedAPI, status]);

  const refreshDustBalance = useCallback(async (): Promise<DustBalanceInfo | null> => {
    const api = connectedAPI;
    if (!api) {
      setDustBalance(null);
      return null;
    }
    try {
      const info = await readDustBalance(api);
      setDustBalance(info);
      return info;
    } catch (err) {
      if (isWalletSessionExpiredError(err)) {
        markSessionExpired();
      }
      return null;
    }
  }, [connectedAPI, markSessionExpired]);

  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const wallets = listMidnightWallets();
      if (wallets.length > 0) {
        setAvailableWallets((prev) => {
          if (
            prev.length === wallets.length &&
            prev.every((w, i) => w.id === wallets[i]?.id)
          ) {
            return prev;
          }
          return wallets;
        });
      }
      attempts++;
      timer = setTimeout(tick, attempts < 30 ? 500 : 5000);
    };

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  // Poll tDUST while connected (generation can change over time).
  useEffect(() => {
    if (!connectedAPI || status !== "connected") {
      setDustBalance(null);
      return;
    }
    let cancelled = false;
    const pull = async () => {
      try {
        const info = await readDustBalance(connectedAPI);
        if (!cancelled) setDustBalance(info);
      } catch (err) {
        if (!cancelled && isWalletSessionExpiredError(err)) {
          markSessionExpired();
        }
      }
    };
    void pull();
    const id = setInterval(() => void pull(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connectedAPI, status, markSessionExpired]);

  // Keep UI honest: 1AM can drop the DApp session while we still show "connected".
  useEffect(() => {
    if (!connectedAPI || status !== "connected") return;
    let cancelled = false;

    const check = async () => {
      const probe = await probeWalletSession(connectedAPI, targetNetwork());
      if (cancelled) return;
      if (!probe.ok) {
        markSessionExpired(
          probe.reason === "wrong-network" ? probe.detail : WALLET_SESSION_EXPIRED_MSG,
        );
      }
    };

    void check();
    const id = setInterval(() => void check(), SESSION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [connectedAPI, status, markSessionExpired]);

  const connectTo = useCallback(async (
    wallet: DetectedWallet,
    options?: { silent?: boolean },
  ): Promise<ConnectedAPI | null> => {
    // Silent restore must not flip the whole chrome into "connecting" (feels hung
    // when 1AM waits on an approval dialog).
    if (!options?.silent) {
      setStatus("connecting");
      setError(null);
    }

    const generation = ++connectGeneration.current;
    let timedOut = false;

    try {
      if (!isOneAmWallet(wallet.api)) {
        throw new Error("CompactLab v1 only supports the 1AM wallet (https://1am.xyz/).");
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const connectPromise = wallet.api.connect(targetNetwork());
      const api: ConnectedAPI = options?.silent
        ? await Promise.race([
            connectPromise,
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                timedOut = true;
                reject(new Error("Wallet restore timed out"));
              }, SILENT_CONNECT_TIMEOUT_MS);
            }),
          ]).finally(() => {
            if (timeoutId) clearTimeout(timeoutId);
          })
        : await connectPromise;

      // A timed-out silent restore may still resolve later; ignore stale results.
      if (generation !== connectGeneration.current || timedOut) {
        return null;
      }

      await assertUsableConnection(api);
      if (generation !== connectGeneration.current) return null;

      const addresses = await api.getShieldedAddresses();
      const { unshieldedAddress } = await api.getUnshieldedAddress();
      const dust = await readDustBalance(api);
      if (generation !== connectGeneration.current) return null;

      setConnectedAPI(api);
      setConnectedWalletName(wallet.api.name || "1AM");
      setWalletInfo({
        shieldedAddress: addresses.shieldedAddress,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        unshieldedAddress,
      });
      setDustBalance(dust);
      setStatus("connected");
      setError(null);
      if (getUserSettingsSnapshot().walletRestoreEnabled) {
        writeWalletRestorePreference(wallet.id);
      } else {
        clearWalletRestorePreference();
      }
      return api;
    } catch (err) {
      if (generation !== connectGeneration.current) return null;
      const message = serializeWalletErr(err);
      if (options?.silent) {
        // Timed-out or rejected restore: stay disconnected, no error banner.
        setStatus("disconnected");
        setError(null);
        return null;
      }
      setError(message);
      setStatus("error");
      setConnectedAPI(null);
      setWalletInfo(null);
      setConnectedWalletName(null);
      setDustBalance(null);
      return null;
    }
  }, []);

  const connect = useCallback(async (): Promise<ConnectedAPI | null> => {
    const wallets = listMidnightWallets();
    setAvailableWallets(wallets);
    if (wallets.length === 0) {
      setError(
        "1AM wallet not found. Install 1AM from https://1am.xyz/, unlock it, enable this site, then reload.",
      );
      setStatus("error");
      return null;
    }
    if (wallets.length > 1) {
      setError("Multiple 1AM injections detected - choose one from the menu.");
      setStatus("error");
      return null;
    }
    return connectTo(wallets[0]);
  }, [connectTo]);

  const disconnect = useCallback(() => {
    clearWalletRestorePreference();
    clearSessionLocal(null, "disconnected");
  }, [clearSessionLocal]);

  // A 1AM session belongs to one network: drop it when the user switches in Settings.
  const hasSession = useRef(false);
  useEffect(() => {
    hasSession.current = connectedAPI !== null;
  }, [connectedAPI]);
  useEffect(
    () =>
      useUserSettings.subscribe((next, prev) => {
        if (next.network === prev.network || !hasSession.current) return;
        const label = getActiveNetwork().label;
        clearSessionLocal(`Network changed to ${label}. Switch 1AM to ${label}, then connect again.`, "disconnected");
      }),
    [clearSessionLocal],
  );

  // After refresh: reconnect last-used 1AM if still authorized (usually no new prompt).
  // Defer so project hydrate / first paint are not blocked by a wallet prompt.
  const restoreAttempted = useRef(false);
  useEffect(() => {
    if (restoreAttempted.current) return;
    if (status !== "disconnected") return;
    if (availableWallets.length === 0) return;
    if (!getUserSettingsSnapshot().walletRestoreEnabled) return;
    const pref = readWalletRestorePreference();
    if (!pref) return;
    const match =
      availableWallets.find((w) => w.id === pref.walletId) ?? availableWallets[0];
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || restoreAttempted.current) return;
      restoreAttempted.current = true;
      void connectTo(match, { silent: true });
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [availableWallets, status, connectTo]);

  return useMemo(
    () => ({
      availableWallets,
      isInstalled: availableWallets.length > 0,
      status,
      error,
      connectedAPI,
      walletInfo,
      connectedWalletName,
      dustBalance,
      refreshDustBalance,
      connectTo,
      connect,
      disconnect,
      ensureSession,
      markSessionExpired,
      refreshWallets,
    }),
    [
      availableWallets,
      status,
      error,
      connectedAPI,
      walletInfo,
      connectedWalletName,
      dustBalance,
      refreshDustBalance,
      connectTo,
      connect,
      disconnect,
      ensureSession,
      markSessionExpired,
      refreshWallets,
    ],
  );
}

export function MidnightWalletProvider({ children }: { children: ReactNode }) {
  const value = useMidnightWalletState();
  return (
    <MidnightWalletContext.Provider value={value}>{children}</MidnightWalletContext.Provider>
  );
}

/** @deprecated Prefer MidnightWalletProvider */
export const LaceWalletProvider = MidnightWalletProvider;

export function useMidnightWallet(): UseMidnightWalletReturn {
  const ctx = useContext(MidnightWalletContext);
  if (!ctx) {
    throw new Error("useMidnightWallet must be used within MidnightWalletProvider");
  }
  return ctx;
}

/** @deprecated Prefer useMidnightWallet */
export const useLaceWallet = useMidnightWallet;
