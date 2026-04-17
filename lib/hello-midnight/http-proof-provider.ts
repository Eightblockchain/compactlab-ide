/**
 * HTTP Proof Provider
 *
 * Creates a ProvingProvider that delegates ZK proof generation to a locally
 * running Docker proof server (midnightntwrk/proof-server on port 6300).
 *
 * The browser calls our Next.js proxy routes (/api/proof/check and
 * /api/proof/prove) which forward the requests server-side to avoid CORS.
 *
 * Protocol (binary, application/octet-stream):
 *   POST /check  body = createCheckPayload(preimage, zkir)
 *                resp = parseCheckResult(...)
 *   POST /prove  body = createProvingPayload(preimage, bindingInput, keyMaterial)
 *                resp = raw proof bytes (Uint8Array)
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
import type { HelloWorldCircuitId } from "./providers";

/**
 * Builds a ProvingProvider backed by a local Docker proof server.
 *
 * We route via the Next.js API proxy (/api/proof/*) to avoid browser CORS
 * restrictions (the proof server at :6300 is a different origin from the DApp
 * at :3000, so direct browser→proof-server calls would be blocked).
 *
 * @param zkConfigProvider - Used to fetch prover keys / verifier keys / zkir files
 *   that are bundled into the binary payload sent to the proof server.
 */
export function makeHttpProvingProvider(
  zkConfigProvider: FetchZkConfigProvider<HelloWorldCircuitId>
): ProvingProvider {
  // Proxy routes live on the same origin as the DApp — no CORS issues.
  const CHECK_URL = "/api/proof/check";
  const PROVE_URL = "/api/proof/prove";

  return {
    async check(
      serializedPreimage: Uint8Array,
      keyLocation: string
    ): Promise<(bigint | undefined)[]> {
      const circuitId = keyLocation as HelloWorldCircuitId;
      const zkir = await zkConfigProvider.getZKIR(circuitId);
      const payload = createCheckPayload(serializedPreimage, zkir);

      const resp = await window.fetch(CHECK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: payload,
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
      overwriteBindingInput?: bigint
    ): Promise<Uint8Array> {
      const circuitId = keyLocation as HelloWorldCircuitId;
      const [proverKey, verifierKey, zkir] = await Promise.all([
        zkConfigProvider.getProverKey(circuitId),
        zkConfigProvider.getVerifierKey(circuitId),
        zkConfigProvider.getZKIR(circuitId),
      ]);

      const payload = createProvingPayload(
        serializedPreimage,
        overwriteBindingInput,
        { proverKey, verifierKey, ir: zkir }
      );

      const resp = await window.fetch(PROVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: payload,
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`Proof server prove failed (${resp.status}): ${body}`);
      }

      return new Uint8Array(await resp.arrayBuffer());
    },
  };
}

/**
 * Creates a full ProofProvider (proveTx method) wrapping the HTTP proof server.
 */
export function makeHttpProofProvider(
  zkConfigProvider: FetchZkConfigProvider<HelloWorldCircuitId>
) {
  const provingProvider = makeHttpProvingProvider(zkConfigProvider);
  return createProofProvider(provingProvider, CostModel.initialCostModel());
}
