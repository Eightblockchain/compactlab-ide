"use client";

/**
 * useLaceWallet – React hook for Midnight Lace wallet connection
 *
 * The Lace wallet browser extension exposes a `window.midnight.mnLace` API.
 * This hook manages the full connection lifecycle:
 *   1. Detect if the Lace wallet extension is installed
 *   2. Connect to the Preprod network
 *   3. Expose wallet addresses and the connected API
 *
 * The wallet solves the proof server problem:
 * When connected, `connectedAPI` can be used with `dappConnectorProofProvider`
 * to delegate ZK proof generation to the wallet's embedded prover.
 * No Docker or local proof server needed by the DApp user.
 */

import { useState, useCallback, useEffect } from "react";
import type {
  ConnectedAPI,
  InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import type { ConnectionStatus, WalletInfo } from "@/lib/hello-midnight/types";

export interface UseLaceWalletReturn {
  /** All Midnight wallets currently injected in window.midnight */
  availableWallets: InitialAPI[];
  /** Whether any Midnight wallet extension is installed */
  isInstalled: boolean;
  /** Current connection status */
  status: ConnectionStatus;
  /** Error message if connection failed */
  error: string | null;
  /** The connected wallet API (available when status === 'connected') */
  connectedAPI: ConnectedAPI | null;
  /** Wallet addresses (available when status === 'connected') */
  walletInfo: WalletInfo | null;
  /** Wallet name shown in UI (from InitialAPI.name) */
  connectedWalletName: string | null;
  /** Connect to a specific wallet. Returns the ConnectedAPI on success, null on failure. */
  connectTo: (wallet: InitialAPI) => Promise<ConnectedAPI | null>;
  /** Connect to the first available wallet (legacy convenience) */
  connect: () => Promise<ConnectedAPI | null>;
  /** Disconnect from the wallet */
  disconnect: () => void;
}

/** Read all wallets currently in window.midnight. */
function getWallets(): InitialAPI[] {
  const midnight = window.midnight;
  if (!midnight) return [];
  return Object.values(midnight);
}

export function useLaceWallet(): UseLaceWalletReturn {
  const [availableWallets, setAvailableWallets] = useState<InitialAPI[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [connectedWalletName, setConnectedWalletName] = useState<string | null>(null);

  // Poll window.midnight up to 5 s — extensions inject after React mounts.
  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let timer: ReturnType<typeof setTimeout>;

    const checkWallets = () => {
      const wallets = getWallets();
      if (wallets.length > 0) {
        setAvailableWallets(wallets);
        return;
      }
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        timer = setTimeout(checkWallets, 500);
      }
    };

    checkWallets();
    return () => clearTimeout(timer);
  }, []);

  const connectTo = useCallback(async (wallet: InitialAPI): Promise<ConnectedAPI | null> => {
    setStatus("connecting");
    setError(null);

    try {
      const api: ConnectedAPI = await wallet.connect("preprod");

      const addresses = await api.getShieldedAddresses();
      const { unshieldedAddress } = await api.getUnshieldedAddress();

      setConnectedAPI(api);
      setConnectedWalletName(wallet.name);
      setWalletInfo({
        shieldedAddress: addresses.shieldedAddress,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        unshieldedAddress,
      });
      setStatus("connected");
      return api;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
      return null;
    }
  }, []);

  const connect = useCallback(async (): Promise<ConnectedAPI | null> => {
    // Re-read at call time in case wallet injected after initial poll.
    const wallets = getWallets();
    const wallet = wallets[0];
    if (!wallet) {
      setError("No Midnight wallet extension found. Install Midnight Lace from lace.io and reload.");
      setStatus("error");
      return null;
    }
    return connectTo(wallet);
  }, [connectTo]);

  const disconnect = useCallback(() => {
    setConnectedAPI(null);
    setWalletInfo(null);
    setConnectedWalletName(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  return {
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
  };
}
