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

export type { DetectedWallet } from "@/lib/wallet-detect";
export { isOneAmWallet, listMidnightWallets } from "@/lib/wallet-detect";
/** v1 install link — CompactLab requires 1AM for wallet-side proving. */
export { MIDNIGHT_WALLET_LINKS } from "@/lib/wallet-links";

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
  /** Re-scan window.midnight after installing/enabling 1AM. */
  refreshWallets: () => void;
}

/** @deprecated Use UseMidnightWalletReturn */
export type UseLaceWalletReturn = UseMidnightWalletReturn;

const MidnightWalletContext = createContext<UseMidnightWalletReturn | null>(null);

const TARGET_NETWORK = "preprod";

function serializeErr(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function assertUsableConnection(api: ConnectedAPI): Promise<void> {
  if (typeof api.getProvingProvider !== "function") {
    throw new Error(
      "Connected wallet does not support getProvingProvider(). CompactLab v1 requires 1AM (https://1am.xyz/).",
    );
  }

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
      // retry
    }
  }

  if (networkId && networkId !== TARGET_NETWORK) {
    throw new Error(
      `Connected to network "${networkId}" but CompactLab expects ${TARGET_NETWORK}. Switch to Preprod in 1AM.`,
    );
  }

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
      if (!isOneAmWallet(wallet.api)) {
        throw new Error("CompactLab v1 only supports the 1AM wallet (https://1am.xyz/).");
      }

      const api: ConnectedAPI = await wallet.api.connect(TARGET_NETWORK);
      await assertUsableConnection(api);

      const addresses = await api.getShieldedAddresses();
      const { unshieldedAddress } = await api.getUnshieldedAddress();

      setConnectedAPI(api);
      setConnectedWalletName(wallet.api.name || "1AM");
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
        "1AM wallet not found. Install 1AM from https://1am.xyz/, unlock it, enable this site, then reload.",
      );
      setStatus("error");
      return null;
    }
    if (wallets.length > 1) {
      setError("Multiple 1AM injections detected — choose one from the menu.");
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
