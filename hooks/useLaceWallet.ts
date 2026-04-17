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
  /** Connect to the wallet. Returns the ConnectedAPI on success, null on failure. */
  connect: () => Promise<ConnectedAPI | null>;
  /** Disconnect from the wallet */
  disconnect: () => void;
}

/** Returns the first available Midnight wallet from window.midnight, or null. */
function detectWallet(): InitialAPI | null {
  const midnight = (window as Window).midnight;
  if (!midnight) return null;
  const wallets = Object.values(midnight);
  return wallets.length > 0 ? wallets[0] ?? null : null;
}

export function useLaceWallet(): UseLaceWalletReturn {
  const [isInstalled, setIsInstalled] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

  // Retry detection up to 10 times × 500 ms (5 s) — extensions often inject
  // into window.midnight a few hundred ms after the React tree mounts.
  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let timer: ReturnType<typeof setTimeout>;

    const checkWallet = () => {
      if (detectWallet()) {
        setIsInstalled(true);
        return;
      }
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        timer = setTimeout(checkWallet, 500);
      }
    };

    checkWallet();
    return () => clearTimeout(timer);
  }, []);

  const connect = useCallback(async (): Promise<ConnectedAPI | null> => {
    setStatus("connecting");
    setError(null);

    try {
      // Re-read window.midnight at call time — don't rely on cached isInstalled.
      const wallet = detectWallet();
      if (!wallet) {
        throw new Error(
          "No Midnight wallet extension found. Make sure the Midnight Lace wallet is installed and enabled, then try again."
        );
      }

      const api: ConnectedAPI = await wallet.connect("preprod");

      const addresses = await api.getShieldedAddresses();
      const { unshieldedAddress } = await api.getUnshieldedAddress();

      setConnectedAPI(api);
      setWalletInfo({
        shieldedAddress: addresses.shieldedAddress,
        shieldedCoinPublicKey: addresses.shieldedCoinPublicKey,
        shieldedEncryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        unshieldedAddress,
      });
      setStatus("connected");
      setIsInstalled(true);
      return api;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnectedAPI(null);
    setWalletInfo(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  return {
    isInstalled,
    status,
    error,
    connectedAPI,
    walletInfo,
    connect,
    disconnect,
  };
}
