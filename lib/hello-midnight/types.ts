/**
 * hello-midnight – shared types
 *
 * All types used by the contract API, the React hooks, and the page.
 */

// ─── Network config ────────────────────────────────────────────────────────────

export type NetworkId = "preprod" | "undeployed";

export interface NetworkConfig {
  networkId: NetworkId;
  indexerUri: string;
  indexerWsUri: string;
  substrateNodeUri: string;
  /** URL of a locally-running proof server (only needed for non-DApp-Connector proving) */
  proofServerUri?: string;
}

// Preprod public endpoints (from Midnight docs)
export const PREPROD_CONFIG: NetworkConfig = {
  networkId: "preprod",
  indexerUri: "https://indexer.preprod.midnight.network/api/v3/graphql",
  indexerWsUri: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
  substrateNodeUri: "wss://rpc.preprod.midnight.network",
};

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
