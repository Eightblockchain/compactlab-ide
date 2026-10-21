/**
 * hello-midnight – shared types
 *
 * All types used by the contract API, the React hooks, and the page.
 */

// ─── Network config ────────────────────────────────────────────────────────────

import type { NetworkInfo } from "@/lib/network";

export type NetworkId = "preprod" | "preview" | "undeployed";

export interface NetworkConfig {
  networkId: NetworkId;
  // Indexer endpoints are not static: see lib/indexer-endpoints.ts (Preprod
  // goes through the CompactLab API proxy or the user's own Blockfrost key).
  substrateNodeUri: string;
  /** URL of a locally-running proof server (only needed for non-DApp-Connector proving) */
  proofServerUri?: string;
}

// Preprod public endpoints (from Midnight docs)
export const PREPROD_CONFIG: NetworkConfig = {
  networkId: "preprod",
  substrateNodeUri: "wss://rpc.preprod.midnight.network",
};

export function networkConfig(network: NetworkInfo): NetworkConfig {
  return { networkId: network.id, substrateNodeUri: network.substrateNodeUri };
}

// ─── Wallet state ──────────────────────────────────────────────────────────────

export interface WalletInfo {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
  unshieldedAddress: string;
}

// ─── Contract state ────────────────────────────────────────────────────────────

export interface HelloWorldState {
  message: string;
}

// ─── API result types ─────────────────────────────────────────────────────────

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface DeployResult {
  contractAddress: string;
}

export interface JoinResult {
  contractAddress: string;
}
