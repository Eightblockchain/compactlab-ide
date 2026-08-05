/** Shared 1AM install links for CompactLab v1 (wallet-side proving). */

export const MIDNIGHT_WALLET_LINKS = [{ name: "1AM", href: "https://1am.xyz/" }] as const;

export type MidnightWalletLink = (typeof MIDNIGHT_WALLET_LINKS)[number];
