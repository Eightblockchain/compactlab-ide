"use client";

/**
 * Shared Midnight DApp Connector state (any wallet on window.midnight).
 *
 * Spec: wallets inject under UUID keys — never hardcode Lace / mnLace.
 * https://docs.midnight.network/guides/react-wallet-connect
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import type { ConnectionStatus, WalletInfo } from "@/lib/hello-midnight/types";

export type DetectedWallet = {
  /** Injection key under window.midnight (usually a UUID). */
  id: string;
  api: InitialAPI;
};

export interface UseMidnightWalletReturn {
  availableWallets: DetectedWallet[];
  isInstalled: boolean;
  status: ConnectionStatus;
  error: string | null;
  connectedAPI: ConnectedAPI | null;
  walletInfo: WalletInfo | null;
  connectedWalletName: string | null;
  connectTo: (wallet: DetectedWallet) => Promise<ConnectedAPI | null>;
  connect: () => Promise<ConnectedAPI | null>;
  disconnect: () => void;
  /** Re-scan window.midnight after installing/enabling an extension. */
  refreshWallets: () => void;
}

/** @deprecated Use UseMidnightWalletReturn */
export type UseLaceWalletReturn = UseMidnightWalletReturn;

const MidnightWalletContext = createContext<UseMidnightWalletReturn | null>(null);

const TARGET_NETWORK = "preprod";

/** Known install / docs links when no extension is detected. */
export const MIDNIGHT_WALLET_LINKS = [
  { name: "1AM", href: "https://1am.xyz/" },
  { name: "Lace (Midnight)", href: "https://www.lace.io/midnight" },
] as const;

export function listMidnightWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];
  const midnight = window.midnight;
  if (!midnight) return [];
  return Object.entries(midnight)
    .filter(
      (entry): entry is [string, InitialAPI] =>
        !!entry[1] &&
        typeof entry[1] === "object" &&
        typeof (entry[1] as InitialAPI).connect === "function",
    )
    .map(([id, api]) => ({ id, api }));
}

function serializeErr(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Official examples assert networkId when present; they do not fail solely on
 * status === "disconnected" right after connect() (some wallets race here).
 */
async function assertUsableConnection(api: ConnectedAPI): Promise<void> {
  if (typeof api.getConnectionStatus !== "function") return;

  let lastStatus: string | undefined;
  let networkId: string | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
    try {
      const cs = await api.getConnectionStatus();
      lastStatus = (cs as { status?: string }).status;
      networkId = (cs as { networkId?: string }).networkId;
      if (lastStatus === "connected") break;
    } catch {
      // Some wallets throw until fully ready — retry
    }
  }

  if (networkId && networkId !== TARGET_NETWORK) {
    throw new Error(
      `Connected to network "${networkId}" but CompactLab expects ${TARGET_NETWORK}. Switch network in your wallet.`,
    );
  }

  // Successful connect() + addresses below is enough; disconnected status is a
  // known quirk on some wallets (e.g. 1AM) immediately after authorize.
  if (lastStatus && lastStatus !== "connected") {
    console.warn(
      `[compactlab] Wallet getConnectionStatus() → "${lastStatus}" after connect(); continuing if address APIs work.`,
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

  const refreshWallets = useCallback(() => {
    setAvailableWallets(listMidnightWallets());
  }, []);

  // Extensions often inject after first paint — poll briefly, then slowly.
  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const wallets = listMidnightWallets();
      if (wallets.length > 0) {
        setAvailableWallets(wallets);
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

  const connectTo = useCallback(async (wallet: DetectedWallet): Promise<ConnectedAPI | null> => {
    setStatus("connecting");
    setError(null);

    try {
      const api: ConnectedAPI = await wallet.api.connect(TARGET_NETWORK);
      await assertUsableConnection(api);

      const addresses = await api.getShieldedAddresses();
      const { unshieldedAddress } = await api.getUnshieldedAddress();

      setConnectedAPI(api);
      setConnectedWalletName(wallet.api.name || wallet.id);
      setWalletInfo({
        shieldedAddress: addresses.shieldedAddress,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        unshieldedAddress,
      });
      setStatus("connected");
      return api;
    } catch (err) {
      const message = serializeErr(err);
      setError(message);
      setStatus("error");
      setConnectedAPI(null);
      setWalletInfo(null);
      setConnectedWalletName(null);
      return null;
    }
  }, []);

  const connect = useCallback(async (): Promise<ConnectedAPI | null> => {
    const wallets = listMidnightWallets();
    setAvailableWallets(wallets);
    if (wallets.length === 0) {
      setError(
        "No Midnight wallet found. Install 1AM or Lace (Midnight), enable it for this site, then reload.",
      );
      setStatus("error");
      return null;
    }
    if (wallets.length > 1) {
      setError("Multiple Midnight wallets detected — choose one from the menu.");
      setStatus("error");
      return null;
    }
    return connectTo(wallets[0]);
  }, [connectTo]);

  const disconnect = useCallback(() => {
    setConnectedAPI(null);
    setWalletInfo(null);
    setConnectedWalletName(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  return useMemo(
    () => ({
      availableWallets,
      isInstalled: availableWallets.length > 0,
      status,
      error,
      connectedAPI,
      walletInfo,
      connectedWalletName,
      connectTo,
      connect,
      disconnect,
      refreshWallets,
    }),
    [
      availableWallets,
      status,
      error,
      connectedAPI,
      walletInfo,
      connectedWalletName,
      connectTo,
      connect,
      disconnect,
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
