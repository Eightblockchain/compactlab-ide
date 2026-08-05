/**
 * Format Dust / tDUST amounts from wallet bigint balances for UI.
 * 1 DUST = 10^15 Specks (Midnight docs).
 */

const DUST_DECIMALS = 15;
const DUST_SCALE = BigInt("1000000000000000"); // 10^15

export function formatDustAmount(raw: bigint): string {
  const negative = raw < BigInt(0);
  const value = negative ? -raw : raw;
  const whole = value / DUST_SCALE;
  const frac = value % DUST_SCALE;
  if (frac === BigInt(0)) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }
  const fracStr = frac
    .toString()
    .padStart(DUST_DECIMALS, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}.${fracStr}`;
}

export type DustBalanceInfo = {
  /** Human-readable current tDUST */
  balanceLabel: string;
  /** Human-readable generation cap from tNIGHT */
  capLabel: string;
  balance: bigint;
  cap: bigint;
  /** True when spendable dust is effectively zero */
  isEmpty: boolean;
};

export async function readDustBalance(
  api: { getDustBalance?: () => Promise<{ balance: bigint; cap: bigint }> },
): Promise<DustBalanceInfo | null> {
  if (typeof api.getDustBalance !== "function") return null;
  try {
    const { balance, cap } = await api.getDustBalance();
    return {
      balance,
      cap,
      balanceLabel: formatDustAmount(balance),
      capLabel: formatDustAmount(cap),
      isEmpty: balance <= BigInt(0),
    };
  } catch {
    return null;
  }
}
