import { describe, expect, it } from "vitest";
import { isWalletSessionExpiredError, isWalletSessionExpiredMessage } from "@/lib/wallet-session";

describe("isWalletSessionExpiredMessage", () => {
  it("treats a dead 1AM proving link as an expired session", () => {
    expect(
      isWalletSessionExpiredMessage(
        "storeMessage failed: Unexpected error submitting scoped transaction '<unnamed>': Error: 'prove' returned an error: Error: Wallet UI disconnected",
      ),
    ).toBe(true);
    expect(isWalletSessionExpiredMessage("Extension context invalidated.")).toBe(true);
  });

  it("keeps the existing expiry messages", () => {
    expect(isWalletSessionExpiredMessage("Connection expired, please reconnect")).toBe(true);
    expect(isWalletSessionExpiredError({ code: "Disconnected" })).toBe(true);
  });

  it("does not treat ordinary failures as expiry", () => {
    expect(isWalletSessionExpiredMessage("Transaction submission error")).toBe(false);
    expect(isWalletSessionExpiredMessage("Insufficient tDUST")).toBe(false);
  });
});
