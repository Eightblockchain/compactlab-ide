/**
 * hello-midnight – Contract providers factory
 *
 * Builds the MidnightProviders bundle from a connected 1AM DApp Connector wallet.
 * ZK proving is delegated to the wallet via getProvingProvider (no Docker).
 */

import type { WalletConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import {
  Transaction,
  SignatureEnabled,
  Proof,
  Binding,
  CostModel,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { dappConnectorProofProvider } from "@midnight-ntwrk/midnight-js-dapp-connector-proof-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { toHex, fromHex } from "@midnight-ntwrk/midnight-js-utils";
import type {
  MidnightProviders,
  WalletProvider,
  MidnightProvider,
  UnboundTransaction,
} from "@midnight-ntwrk/midnight-js-types";
import type { TransactionId } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { NetworkConfig } from "./types";
import type { FeeMode } from "@/lib/fee-mode";
import { apiFetch } from "@/lib/api";

export type HelloWorldCircuitId = "storeMessage";
export const HELLO_WORLD_PSI = "helloWorldPrivateState" as const;
export type HelloWorldPrivateStateId = typeof HELLO_WORLD_PSI;
export type HelloWorldPrivateState = Record<string, never>;

export type HelloWorldProviders = MidnightProviders<
  HelloWorldCircuitId,
  HelloWorldPrivateStateId,
  HelloWorldPrivateState
>;

/**
 * Creates all MidnightProviders needed for the hello-world contract.
 *
 * @param wallet - Connected 1AM DApp Connector wallet API
 * @param config - Network configuration (indexer / node URIs)
 * @param feeMode - self-pay (v1 default) or sponsored when NEXT_PUBLIC_ENABLE_SPONSORED=1
 */
export async function createHelloWorldProviders(
  wallet: WalletConnectedAPI,
  config: NetworkConfig,
  feeMode: FeeMode = "self",
): Promise<HelloWorldProviders> {
  setNetworkId(config.networkId);

  if (typeof wallet.getProvingProvider !== "function") {
    throw new Error(
      "CompactLab v1 requires the 1AM wallet for ZK proving (https://1am.xyz/).",
    );
  }

  const addresses = await wallet.getShieldedAddresses();
  const coinPublicKey = addresses.shieldedCoinPublicKey;

  const zkConfigBaseUrl = `${window.location.origin}/contracts/hello-world`;
  const zkConfigProvider = new FetchZkConfigProvider<HelloWorldCircuitId>(
    zkConfigBaseUrl,
    (url: string | Request | URL, init?: RequestInit) => window.fetch(url, init),
  );

  const proofProvider = await dappConnectorProofProvider(
    wallet,
    zkConfigProvider,
    CostModel.initialCostModel(),
  );

  const publicDataProvider = indexerPublicDataProvider(
    config.indexerUri,
    config.indexerWsUri,
  );

  const storagePassword = `${coinPublicKey}!Mn`;
  const privateStateProvider = levelPrivateStateProvider<
    HelloWorldPrivateStateId,
    HelloWorldPrivateState
  >({
    privateStoragePasswordProvider: () => storagePassword,
    accountId: `hello-world:${coinPublicKey}`,
  });

  const payFees = feeMode === "self";

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => addresses.shieldedEncryptionPublicKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    balanceTx: async (tx: UnboundTransaction, _ttl?: Date): Promise<any> => {
      const hexUnbound = toHex(tx.serialize());
      const { tx: hexBalanced } = await wallet.balanceUnsealedTransaction(
        hexUnbound,
        { payFees },
      );
      return Transaction.deserialize(
        "signature" as SignatureEnabled["instance"],
        "proof" as Proof["instance"],
        "binding" as Binding["instance"],
        fromHex(hexBalanced),
      );
    },
  };

  const midnightProvider: MidnightProvider = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitTx: async (tx: any): Promise<TransactionId> => {
      const hexFinalized = toHex(tx.serialize());
      if (feeMode === "sponsored") {
        const res = await apiFetch("/v1/sponsor", {
          method: "POST",
          json: { tx: hexFinalized },
        });
        const text = await res.text();
        let body: { txId?: string; error?: string } = {};
        try {
          body = text ? (JSON.parse(text) as typeof body) : {};
        } catch {
          throw new Error(
            `Sponsor returned non-JSON (${res.status}): ${text.trim().slice(0, 160) || res.statusText}`,
          );
        }
        if (!res.ok) {
          throw new Error(
            body.error || `Sponsorship failed (${res.status}). Switch to Self-pay or retry later.`,
          );
        }
        return (body.txId || hexFinalized.slice(0, 64)) as TransactionId;
      }
      await wallet.submitTransaction(hexFinalized);
      const ids = tx.identifiers();
      return ids[0] ?? hexFinalized.slice(0, 64);
    },
  };

  return {
    zkConfigProvider,
    proofProvider,
    publicDataProvider,
    privateStateProvider,
    walletProvider,
    midnightProvider,
  };
}
