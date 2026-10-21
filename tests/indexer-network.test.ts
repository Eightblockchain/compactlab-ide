import { describe, expect, it } from "vitest";
import { NETWORKS, networkInfoFor, normalizeNetwork } from "../lib/network";
import { isPlausibleBlockfrostKey, ownKeyEndpoints } from "../lib/own-blockfrost-key";
import { explainIndexerLimit } from "../lib/indexer-endpoints";

describe("networks", () => {
  it("falls back to Preprod for unknown ids", () => {
    expect(normalizeNetwork("mainnet")).toBe("preprod");
    expect(networkInfoFor("undeployed").id).toBe("preprod");
    expect(networkInfoFor("preview").id).toBe("preview");
  });

  it("only Preview has a public indexer, only Preprod has sponsorship", () => {
    expect(NETWORKS.preview.publicIndexer?.http).toMatch(/^https:\/\/indexer\.preview\.midnight\.network\//);
    expect(NETWORKS.preprod.publicIndexer).toBeNull();
    expect(NETWORKS.preprod.sponsorship).toBe(true);
    expect(NETWORKS.preview.sponsorship).toBe(false);
  });
});

describe("own Blockfrost key", () => {
  it("accepts Midnight Preprod project ids only", () => {
    expect(isPlausibleBlockfrostKey("nightpreprodAbCdEf0123456789")).toBe(true);
    expect(isPlausibleBlockfrostKey("mainnetAbCdEf0123456789")).toBe(false);
    expect(isPlausibleBlockfrostKey("nightpreprod?x=1")).toBe(false);
  });

  it("puts the key in the query string for both transports", () => {
    const e = ownKeyEndpoints("nightpreprodAbCdEf0123456789");
    expect(e.indexerUri).toBe("https://midnight-preprod.blockfrost.io/api/v0?project_id=nightpreprodAbCdEf0123456789");
    expect(e.indexerWsUri).toBe("wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=nightpreprodAbCdEf0123456789");
  });
});

describe("explainIndexerLimit", () => {
  it("passes through the API's readable limit message", () => {
    const msg = "CompactLab has used today's shared Preprod indexer allowance. It resets at 00:00 UTC.";
    expect(explainIndexerLimit(new Error(msg))).toBe(msg);
  });

  it("explains WebSocket close 4402", () => {
    expect(explainIndexerLimit({ code: 4402, reason: "INDEXER_DAILY_LIMIT" })).toMatch(/Blockfrost key in Settings/);
    expect(explainIndexerLimit({ code: 4402, reason: "INDEXER_UPSTREAM_BUSY" })).toMatch(/busy/);
  });

  it("ignores unrelated errors", () => {
    expect(explainIndexerLimit(new Error("Insufficient funds"))).toBeNull();
  });
});
