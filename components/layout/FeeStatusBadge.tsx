"use client";

import { Badge } from "@/components/ui";
import type { FeeMode, SponsorStatusResponse } from "@/lib/fee-mode";

type Props = {
  feeMode: FeeMode;
  status: SponsorStatusResponse | null;
};

type View = {
  label: string;
  variant: "success" | "warning" | "error" | "muted";
  title: string;
};

const SPONSORED_HELP =
  "CompactLab pays the network fee (tDUST). You still prove and sign in 1AM. Switch fee mode in the ⋯ menu.";

/** What the Topbar says about fees for this user right now. */
export function feeStatusView(feeMode: FeeMode, status: SponsorStatusResponse | null): View {
  if (feeMode === "self") {
    return {
      label: "Fees: self-pay",
      variant: "muted",
      title: "You pay network fees from your own tDUST in 1AM. Switch to Sponsored in the ⋯ menu.",
    };
  }
  if (!status) {
    return { label: "Fees: checking…", variant: "muted", title: "Checking CompactLab's fee sponsor…" };
  }
  const access = status.access;
  if (access?.blockedBy === "allowlist") {
    return {
      label: "Fees: self-pay",
      variant: "muted",
      title: access.reason ?? "Sponsored fees are invite-only during the beta.",
    };
  }
  if (access?.blockedBy === "daily_limit") {
    return {
      label: "Sponsored: 0 left today",
      variant: "warning",
      title: access.reason ?? "Daily sponsored limit reached. It resets at 00:00 UTC.",
    };
  }
  if (!status.enabled) {
    return {
      label: "Sponsored fees off",
      variant: "muted",
      title: status.reason ?? "Sponsorship is turned off on this server. Use Self-pay.",
    };
  }
  if (!status.healthy && status.syncing) {
    return {
      label: "Sponsored fees starting…",
      variant: "warning",
      title: `${status.reason ?? "The fee sponsor is starting."} Use Self-pay meanwhile.`,
    };
  }
  if (!status.healthy) {
    return {
      label: "Sponsored fees unavailable",
      variant: "error",
      title: status.reason ?? "The fee sponsor is not available right now. Use Self-pay.",
    };
  }
  const left = access?.remainingToday;
  return {
    label: left === undefined ? "Fees: sponsored" : `Fees: sponsored (${left} left today)`,
    variant: "success",
    title:
      left === undefined
        ? SPONSORED_HELP
        : `${SPONSORED_HELP} ${left} of ${access!.dailyLimit} sponsored transactions left today (resets 00:00 UTC).`,
  };
}

export function FeeStatusBadge({ feeMode, status }: Props) {
  const view = feeStatusView(feeMode, status);
  return (
    <span title={view.title} className="cursor-default">
      <Badge variant={view.variant} size="md" dot>
        {view.label}
      </Badge>
    </span>
  );
}
