/**
 * Midnight networks the playground can target.
 *
 * Preprod is the default: 1AM, the faucet and sponsored fees all target it. Its
 * indexer is Blockfrost-hosted and metered, so it goes through the CompactLab
 * API (shared quota) unless the user adds their own Blockfrost key.
 *
 * Preview runs the same toolchain (ledger 8, compiler 0.31.1, Midnight.js 4.1.1;
 * see docs.midnight.network/relnotes/support-matrix) and Midnight still hosts a
 * free public indexer for it, so it works when the shared Preprod quota is used
 * up. Contracts on one network are not visible on the other.
 */

export type PlaygroundNetwork = "preprod" | "preview";

export type NetworkInfo = {
  id: PlaygroundNetwork;
  label: string;
  /** Node RPC (WebSocket). */
  substrateNodeUri: string;
  faucetUrl: string;
  /** Public indexer that needs no token; null means "via the CompactLab API". */
  publicIndexer: { http: string; ws: string } | null;
  /** CompactLab's fee sponsor runs on Preprod only. */
  sponsorship: boolean;
  explorers: { oneAm: string; midnightExplorer: string | null; subscan: string | null };
};

export const NETWORKS: Record<PlaygroundNetwork, NetworkInfo> = {
  preprod: {
    id: "preprod",
    label: "Preprod",
    substrateNodeUri: "wss://rpc.preprod.midnight.network",
    faucetUrl: "https://faucet.preprod.midnight.network/",
    publicIndexer: null,
    sponsorship: true,
    explorers: {
      oneAm: "https://explorer.1am.xyz",
      midnightExplorer: "https://preprod.midnightexplorer.com",
      subscan: "https://midnight-preprod.subscan.io",
    },
  },
  preview: {
    id: "preview",
    label: "Preview",
    substrateNodeUri: "wss://rpc.preview.midnight.network",
    faucetUrl: "https://faucet.preview.midnight.network/",
    publicIndexer: {
      http: "https://indexer.preview.midnight.network/api/v4/graphql",
      ws: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
    },
    sponsorship: false,
    explorers: { oneAm: "https://explorer.1am.xyz", midnightExplorer: null, subscan: null },
  },
};

export const DEFAULT_NETWORK: PlaygroundNetwork = "preprod";

export function isPlaygroundNetwork(value: unknown): value is PlaygroundNetwork {
  return value === "preprod" || value === "preview";
}

export function normalizeNetwork(value: unknown): PlaygroundNetwork {
  return isPlaygroundNetwork(value) ? value : DEFAULT_NETWORK;
}

/** SDK network id → playground network (anything else, e.g. "undeployed", reads as Preprod). */
export function networkInfoFor(networkId: string): NetworkInfo {
  return NETWORKS[normalizeNetwork(networkId)];
}
