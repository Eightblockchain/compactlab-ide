import { describe, expect, it } from "vitest";
import { feeStatusView } from "../components/layout/FeeStatusBadge";
import {
  sponsorOffered,
  sponsorUnavailableReason,
  sponsorUsable,
  type SponsorStatusResponse,
} from "../lib/fee-mode";

const healthy: SponsorStatusResponse = {
  enabled: true,
  healthy: true,
  configured: true,
  dustBalance: "1",
  dustCap: "1",
  reason: null,
  access: { allowed: true, blockedBy: null, reason: null, dailyLimit: 20, remainingToday: 7 },
};

describe("fee status badge", () => {
  it("shows the sponsored count left today", () => {
    const v = feeStatusView("sponsored", healthy);
    expect(v.label).toBe("Fees: sponsored (7 left today)");
    expect(v.variant).toBe("success");
  });

  it("says self-pay when the user is not on the invite list", () => {
    const v = feeStatusView("sponsored", {
      ...healthy,
      access: { allowed: false, blockedBy: "allowlist", reason: "invite-only", dailyLimit: 20, remainingToday: 0 },
    });
    expect(v.label).toBe("Fees: self-pay");
    expect(v.title).toBe("invite-only");
  });

  it("warns when today's quota is used up", () => {
    const v = feeStatusView("sponsored", {
      ...healthy,
      access: { allowed: false, blockedBy: "daily_limit", reason: "limit", dailyLimit: 20, remainingToday: 0 },
    });
    expect(v.label).toBe("Sponsored: 0 left today");
    expect(v.variant).toBe("warning");
  });

  it("shows starting while the sponsor loads, and unavailable when it is down", () => {
    expect(feeStatusView("sponsored", { ...healthy, healthy: false, syncing: true }).label).toBe(
      "Sponsored fees starting…",
    );
    expect(feeStatusView("sponsored", { ...healthy, healthy: false, syncing: false }).label).toBe(
      "Sponsored fees unavailable",
    );
  });

  it("shows self-pay when sponsorship is off on the server", () => {
    const v = feeStatusView("sponsored", { ...healthy, enabled: false, healthy: false, reason: "off" });
    expect(v.label).toBe("Fees: self-pay");
    expect(v.title).toBe("off");
  });

  it("shows self-pay when the user chose it", () => {
    expect(feeStatusView("self", healthy).label).toBe("Fees: self-pay");
  });
});

describe("sponsorUsable", () => {
  it("needs a healthy sponsor and an allowed user", () => {
    expect(sponsorUsable(healthy)).toBe(true);
    expect(sponsorUsable({ ...healthy, healthy: false })).toBe(false);
    const blocked = {
      ...healthy,
      access: { allowed: false, blockedBy: "allowlist" as const, reason: "invite-only", dailyLimit: 20, remainingToday: 0 },
    };
    expect(sponsorUsable(blocked)).toBe(false);
    expect(sponsorUnavailableReason(blocked)).toBe("invite-only");
    expect(sponsorUsable(null)).toBe(false);
  });
});

describe("sponsorOffered", () => {
  it("hides Sponsored when the server has it off or the user is not invited", () => {
    expect(sponsorOffered(null)).toBe(true);
    expect(sponsorOffered(healthy)).toBe(true);
    expect(sponsorOffered({ ...healthy, enabled: false })).toBe(false);
    expect(
      sponsorOffered({
        ...healthy,
        access: { allowed: false, blockedBy: "allowlist", reason: "invite-only", dailyLimit: 20, remainingToday: 0 },
      }),
    ).toBe(false);
  });

  it("keeps Sponsored offered when only today's quota or health is the problem", () => {
    expect(sponsorOffered({ ...healthy, healthy: false, syncing: true })).toBe(true);
    expect(
      sponsorOffered({
        ...healthy,
        access: { allowed: false, blockedBy: "daily_limit", reason: "limit", dailyLimit: 20, remainingToday: 0 },
      }),
    ).toBe(true);
  });
});

describe("beta access states", () => {
  const blocked = (blockedBy: "unverified" | "waitlist", beta?: { waitlistPosition: number }) => ({
    ...healthy,
    access: {
      allowed: false,
      blockedBy,
      reason: "why",
      dailyLimit: 20,
      remainingToday: 0,
      beta: beta
        ? { inviteCode: "b", inviteName: "Beta", state: "waitlist" as const, seats: 10, seatsTaken: 10, joinedAt: "", ...beta }
        : null,
    },
  });

  it("asks to confirm the email first", () => {
    expect(feeStatusView("sponsored", blocked("unverified")).label).toBe("Fees: confirm email");
    expect(sponsorOffered(blocked("unverified"))).toBe(false);
  });

  it("shows the waitlist place and hides the Sponsored choice", () => {
    const status = blocked("waitlist", { waitlistPosition: 3 });
    expect(feeStatusView("sponsored", status).label).toBe("Beta waitlist #3");
    expect(sponsorOffered(status)).toBe(false);
  });
});
