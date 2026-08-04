/** Preprod explorer deep-links for CompactLab deploy results. */

export const PREPROD_EXPLORERS = {
  midnightExplorer: "https://preprod.midnightexplorer.com",
  oneAm: "https://explorer.1am.xyz",
  subscan: "https://midnight-preprod.subscan.io",
} as const;

/** Primary link — 1AM indexes Compact contracts reliably on Preprod. */
export function oneAmContractUrl(address: string): string {
  return `${PREPROD_EXPLORERS.oneAm}/contract/${address.trim()}?network=preprod`;
}

export function oneAmTxUrl(txHash: string): string {
  return `${PREPROD_EXPLORERS.oneAm}/tx/${txHash.trim()}?network=preprod`;
}

export function preprodContractExplorerLinks(address: string) {
  const a = address.trim();
  return [
    {
      name: "1AM Explorer",
      href: oneAmContractUrl(a),
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
      href: oneAmTxUrl(h),
    },
    {
      name: "Subscan",
      href: `${PREPROD_EXPLORERS.subscan}/extrinsic/${h}`,
    },
  ];
}
