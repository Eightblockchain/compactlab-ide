/**
 * Persist last successful 1AM connection for silent restore after refresh.
 * Kept separate from the React wallet hook so Settings can clear it without
 * pulling the full provider module into extra import graphs.
 */

const RESTORE_KEY = "compactlab:wallet:restore";
export const WALLET_RESTORE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type WalletRestorePayload = { walletId: string; expiresAt: number };

export function readWalletRestorePreference(): WalletRestorePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletRestorePayload;
    if (!parsed?.walletId || typeof parsed.expiresAt !== "number") {
      localStorage.removeItem(RESTORE_KEY);
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(RESTORE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeWalletRestorePreference(walletId: string) {
  if (typeof window === "undefined") return;
  try {
    const payload: WalletRestorePayload = {
      walletId,
      expiresAt: Date.now() + WALLET_RESTORE_TTL_MS,
    };
    localStorage.setItem(RESTORE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

export function clearWalletRestorePreference() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RESTORE_KEY);
  } catch {
    /* ignore */
  }
}
