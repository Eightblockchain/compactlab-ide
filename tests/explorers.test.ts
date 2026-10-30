import { describe, expect, it } from "vitest";
import { contractExplorerUrl, txExplorerUrl } from "@/lib/explorers";

describe("explorer links", () => {
  it("point contracts and transactions at Midnight Explorer for the given network", () => {
    expect(contractExplorerUrl(" abc123 ", "preprod")).toBe("https://preprod.midnightexplorer.com/contracts/abc123");
    expect(txExplorerUrl("deadbeef", "preprod")).toBe("https://preprod.midnightexplorer.com/transactions/deadbeef");
    expect(txExplorerUrl("deadbeef", "preview")).toBe("https://preview.midnightexplorer.com/transactions/deadbeef");
  });
});
