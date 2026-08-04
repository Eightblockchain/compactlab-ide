/**
 * HTTP Proof Provider
 *
 * Delegates ZK proof generation to Docker proof-server via /api/proof/* proxies.
 */

import {
  createCheckPayload,
  createProvingPayload,
  parseCheckResult,
  type ProvingProvider,
} from "@midnight-ntwrk/ledger-v8";
import { createProofProvider } from "@midnight-ntwrk/midnight-js-types";
import { CostModel } from "@midnight-ntwrk/ledger-v8";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyZkConfig = FetchZkConfigProvider<any>;

export function makeHttpProvingProvider(
  zkConfigProvider: AnyZkConfig,
): ProvingProvider {
  const CHECK_URL = "/api/proof/check";
  const PROVE_URL = "/api/proof/prove";

  return {
    async check(
      serializedPreimage: Uint8Array,
      keyLocation: string,
    ): Promise<(bigint | undefined)[]> {
      const zkir = await zkConfigProvider.getZKIR(keyLocation);
      const payload = createCheckPayload(serializedPreimage, zkir);

      const resp = await window.fetch(CHECK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: payload as BodyInit,
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`Proof server check failed (${resp.status}): ${body}`);
      }

      return parseCheckResult(new Uint8Array(await resp.arrayBuffer()));
    },

    async prove(
      serializedPreimage: Uint8Array,
      keyLocation: string,
      overwriteBindingInput?: bigint,
    ): Promise<Uint8Array> {
      const [proverKey, verifierKey, zkir] = await Promise.all([
        zkConfigProvider.getProverKey(keyLocation),
        zkConfigProvider.getVerifierKey(keyLocation),
        zkConfigProvider.getZKIR(keyLocation),
      ]);

      const payload = createProvingPayload(serializedPreimage, overwriteBindingInput, {
        proverKey,
        verifierKey,
        ir: zkir,
      });

      const resp = await window.fetch(PROVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: payload as BodyInit,
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`Proof server prove failed (${resp.status}): ${body}`);
      }

      return new Uint8Array(await resp.arrayBuffer());
    },
  };
}

export function makeHttpProofProvider(zkConfigProvider: AnyZkConfig) {
  const provingProvider = makeHttpProvingProvider(zkConfigProvider);
  return createProofProvider(provingProvider, CostModel.initialCostModel());
}
