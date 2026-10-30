/** Explorer deep-links for CompactLab deploy and call results (Midnight Explorer). */

import { NETWORKS, type PlaygroundNetwork } from "@/lib/network";
import { getActiveNetwork } from "@/lib/user-settings";

export const EXPLORER_NAME = "Midnight Explorer";

/** Contract page. Defaults to the active network. */
export function contractExplorerUrl(address: string, network: PlaygroundNetwork = getActiveNetwork().id): string {
  return `${NETWORKS[network].explorer}/contracts/${address.trim()}`;
}

/** Transaction page. Pass the tx hash: explorers don't index the tx id. */
export function txExplorerUrl(txHash: string, network: PlaygroundNetwork = getActiveNetwork().id): string {
  return `${NETWORKS[network].explorer}/transactions/${txHash.trim()}`;
}
