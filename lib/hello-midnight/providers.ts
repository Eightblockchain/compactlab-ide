/**
 * hello-midnight – Contract providers factory
 *
 * Builds the MidnightProviders bundle from a connected DApp Connector wallet.
 *
 * KEY INSIGHT — Proof server challenge solved:
 * Midnight ZK proofs are local by design. The Lace wallet browser extension
 * runs its own embedded proof server. The DApp delegates proof generation to
 * the wallet via `dappConnectorProofProvider`. No Docker required for users.
 *
 * Architecture:
 *   DApp → Lace wallet extension (embedded prover) → Midnight Preprod network
 */

import type { WalletConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import {
  Transaction,
  SignatureEnabled,
  Proof,
  Binding,
  CostModel,
} from "@midnight-ntwrk/ledger-v8";
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
import type {
  FinalizedTransaction,
  TransactionId,
} from "@midnight-ntwrk/ledger-v8";
import type { NetworkConfig } from "./types";

// ─── Type aliases specific to hello-world ───────────────────────────────────

export type HelloWorldCircuitId = "storeMessage";
export const HELLO_WORLD_PSI = "helloWorldPrivateState" as const;
export type HelloWorldPrivateStateId = typeof HELLO_WORLD_PSI;
// hello-world has no private state
export type HelloWorldPrivateState = Record<string, never>;

export type HelloWorldProviders = MidnightProviders<
  HelloWorldCircuitId,
  HelloWorldPrivateStateId,
  HelloWorldPrivateState
>;

// ─── Provider factory ────────────────────────────────────────────────────────

/**
 * Creates all MidnightProviders needed for the hello-world contract.
 *
 * @param wallet - Connected DApp Connector wallet API (from Lace extension)
 * @param config - Network configuration (indexer / node URIs)
 */
export async function createHelloWorldProviders(
  wallet: WalletConnectedAPI,
  config: NetworkConfig
): Promise<HelloWorldProviders> {
  // 1. Configure the network globally before anything else
  setNetworkId(config.networkId);

  // 2. Get wallet addresses (needed for WalletProvider + private state scoping)
  const addresses = await wallet.getShieldedAddresses();
  const coinPublicKey = addresses.shieldedCoinPublicKey;

  // 3. ZK config provider — serves keys/zkir from /public/contracts/hello-world/
  const zkConfigBaseUrl = `${window.location.origin}/contracts/hello-world`;
  const zkConfigProvider = new FetchZkConfigProvider<HelloWorldCircuitId>(
    zkConfigBaseUrl
  );

  // 4. Proof provider — delegates proving to the Lace wallet extension.
  //    The wallet runs a local prover; no Docker needed for the end user.
  const costModel = CostModel.initialCostModel();
  const proofProvider = await dappConnectorProofProvider(
    wallet,
    zkConfigProvider,
    costModel
  );

  // 5. Public data provider — reads ledger state via Midnight's indexer
  const publicDataProvider = indexerPublicDataProvider(
    config.indexerUri,
    config.indexerWsUri
  );

  // 6. Private state provider — browser IndexedDB, scoped to this wallet
  const privateStateProvider = levelPrivateStateProvider<
    HelloWorldPrivateStateId,
    HelloWorldPrivateState
  >({
    privateStoragePasswordProvider: () => coinPublicKey,
    accountId: coinPublicKey,
  });

  // 7. Wallet provider — serializes/deserializes transactions for the wallet API
  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => addresses.shieldedEncryptionPublicKey,

    /**
     * Balance an unbound transaction (SignatureEnabled, Proof, PreBinding)
     * through the Lace wallet, returning a finalized transaction
     * (SignatureEnabled, Proof, Binding).
     */
    balanceTx: async (
      tx: UnboundTransaction,
      _ttl?: Date
    ): Promise<FinalizedTransaction> => {
      const hexUnbound = toHex(tx.serialize());
      const { tx: hexBalanced } =
        await wallet.balanceUnsealedTransaction(hexUnbound);
      return Transaction.deserialize(
        "signature" as SignatureEnabled["instance"],
        "proof" as Proof["instance"],
        "binding" as Binding["instance"],
        fromHex(hexBalanced)
      ) as FinalizedTransaction;
    },
  };

  // 8. Midnight provider — submits finalized transactions to the network
  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
      const hexFinalized = toHex(tx.serialize());
      await wallet.submitTransaction(hexFinalized);
      // identifiers() returns an array of transaction IDs
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
