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
  /** Whether the Lace wallet extension is installed */
  isInstalled: boolean;
  /** Current connection status */
  status: ConnectionStatus;
  /** Error message if connection failed */
  error: string | null;
  /** The connected wallet API (available when status === 'connected') */
  connectedAPI: ConnectedAPI | null;
  /** Wallet addresses (available when status === 'connected') */
  walletInfo: WalletInfo | null;
  /** Connect to the Lace wallet */
  connect: () => Promise<void>;
  /** Disconnect from the wallet */
  disconnect: () => void;
}

export function useLaceWallet(): UseLaceWalletReturn {
  const [isInstalled, setIsInstalled] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

  // Detect wallet on mount (window is not available during SSR)
  useEffect(() => {
    const checkWallet = () => {
      const wallet = (window as WindowWithMidnight).midnight?.mnLace;
      setIsInstalled(!!wallet);
    };

    checkWallet();

    // Re-check if the wallet injects itself after page load
    const timer = setTimeout(checkWallet, 1000);
    return () => clearTimeout(timer);
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);

    try {
      const wallet = (window as WindowWithMidnight).midnight?.mnLace;
      if (!wallet) {
        throw new Error(
          "Lace wallet extension not found. Please install the Midnight Lace wallet."
        );
      }

      // Connect to Preprod network — this will prompt the user in the wallet extension
      const api: ConnectedAPI = await wallet.connect("preprod");

      // Fetch wallet addresses for display + provider setup
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
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

// ─── Types for window.midnight ───────────────────────────────────────────────

interface WindowWithMidnight {
  midnight?: {
    mnLace?: InitialAPI;
  };
}
