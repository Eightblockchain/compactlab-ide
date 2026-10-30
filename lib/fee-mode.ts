/**
 * Deploy/Call fee payment mode.
 *
 * - sponsored: CompactLab API pays DUST fees (the playground seals the tx itself; 1AM only proves)
 * - self: user pays fees from their own tDUST via 1AM (current default path historically)
 */

export type FeeMode = "sponsored" | "self";

/**
 * Feature flag: Sponsored fees are experimental and OFF for v1.
 *
 * The mechanics follow example-private-party (user balances
 * ['shielded','unshielded'], sponsor balances ['dust']), but the sponsor wallet
 * needs NIGHT registered for Dust generation on Preprod, which we could not
 * provision reliably yet (see docs/SPONSORSHIP.md). Set
 * NEXT_PUBLIC_ENABLE_SPONSORED=1 to re-enable the UI once the sponsor wallet
 * has spendable tDUST.
 */
export const SPONSORED_FEES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SPONSORED === "1";

export const DEFAULT_FEE_MODE: FeeMode = SPONSORED_FEES_ENABLED
  ? "sponsored"
  : "self";

export function isFeeMode(value: unknown): value is FeeMode {
  return value === "sponsored" || value === "self";
}

/** Coerce any persisted/unknown value to a valid mode for the current build. */
export function normalizeFeeMode(value: unknown): FeeMode {
  if (!SPONSORED_FEES_ENABLED) return "self";
  return isFeeMode(value) ? value : DEFAULT_FEE_MODE;
}

export function feeModeLabel(mode: FeeMode): string {
  return mode === "sponsored" ? "Sponsored" : "Self-pay";
}

export function feeModeHelp(mode: FeeMode): string {
  return mode === "sponsored"
    ? "Sponsored: CompactLab pays network fees. You still prove in 1AM."
    : "Self-pay: fees come from your tDUST.";
}

export type SponsorStatusResponse = {
  enabled: boolean;
  healthy: boolean;
  configured: boolean;
  dustBalance: string | null;
  dustCap: string | null;
  reason: string | null;
  syncing?: boolean;
  unshieldedAddress?: string | null;
  /** This user's access: invite list and today's quota (API ≥ S05). */
  access?: SponsorAccess;
};

export type SponsorAccess = {
  allowed: boolean;
  blockedBy: "unverified" | "allowlist" | "waitlist" | "daily_limit" | null;
  reason: string | null;
  dailyLimit: number;
  remainingToday: number;
  /** Beta invite membership, when the user joined through an invite link. */
  beta?: import("@/lib/api").BetaMembership | null;
};

/** Limits that make Sponsored unavailable until something changes on the server side. */
const NOT_OFFERED = new Set<SponsorAccess["blockedBy"]>(["allowlist", "waitlist", "unverified"]);

/** Sponsored fees can pay for this user's next transaction right now. */
export function sponsorUsable(status: SponsorStatusResponse | null): boolean {
  return Boolean(status?.healthy) && status?.access?.allowed !== false;
}

/**
 * Sponsored is worth offering to this user at all: the server has it on, the
 * user is invited (and not waitlisted) and their email is confirmed. While
 * status is still loading, assume yes.
 */
export function sponsorOffered(status: SponsorStatusResponse | null): boolean {
  return !status || (status.enabled && !NOT_OFFERED.has(status.access?.blockedBy ?? null));
}

/** The mode a Deploy or Call actually uses: Self-pay when Sponsored isn't offered. */
export function effectiveFeeMode(mode: FeeMode, status: SponsorStatusResponse | null): FeeMode {
  return SPONSORED_FEES_ENABLED && sponsorOffered(status) ? mode : "self";
}

/** Why Sponsored can't be used now, for the fallback prompt. */
export function sponsorUnavailableReason(status: SponsorStatusResponse | null): string {
  if (status?.access && !status.access.allowed && status.access.reason) return status.access.reason;
  return status?.reason ?? "Sponsor is not healthy yet. You can pay fees yourself with tDUST.";
}
