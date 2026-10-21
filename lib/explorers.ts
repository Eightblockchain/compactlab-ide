/** Explorer deep-links for CompactLab deploy results. */

import { NETWORKS, type PlaygroundNetwork } from "@/lib/network";
import { getActiveNetwork } from "@/lib/user-settings";

export const PREPROD_EXPLORERS = NETWORKS.preprod.explorers;

/** Primary link — 1AM indexes Compact contracts on Preprod and Preview. Defaults to the active network. */
export function oneAmContractUrl(address: string, network: PlaygroundNetwork = getActiveNetwork().id): string {
  return `${NETWORKS[network].explorers.oneAm}/contract/${address.trim()}?network=${network}`;
}

export function oneAmTxUrl(txHash: string, network: PlaygroundNetwork = getActiveNetwork().id): string {
  return `${NETWORKS[network].explorers.oneAm}/tx/${txHash.trim()}?network=${network}`;
}

export function preprodContractExplorerLinks(address: string) {
  const a = address.trim();
  return [
    {
      name: "1AM Explorer",
      href: oneAmContractUrl(a, "preprod"),
    },
    {
      name: "Midnight Explorer",
      href: `${PREPROD_EXPLORERS.midnightExplorer}/contracts/${a}`,
    },
  ];
}

export function preprodTxExplorerLinks(txHash: string) {
  const h = txHash.trim();
  return [
    {
      name: "1AM Explorer",
      href: oneAmTxUrl(h, "preprod"),
    },
    {
      name: "Subscan",
      href: `${PREPROD_EXPLORERS.subscan}/extrinsic/${h}`,
    },
  ];
}
