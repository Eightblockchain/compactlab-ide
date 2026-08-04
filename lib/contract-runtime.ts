/**
 * Generic Midnight contract runtime for playground deploy/call.
 *
 * Supports bundled templates under /public/contracts/<slug>/ and
 * per-project managed artifacts under /contracts/managed/<projectId>/.
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
import {
  deployContract,
  findDeployedContract,
  getPublicStates,
} from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import type { NetworkConfig } from "@/lib/hello-midnight/types";
import { PREPROD_CONFIG } from "@/lib/hello-midnight/types";
import { loadBrowserContractModule } from "@/lib/browser-contract-module";
import {
  buildPrivateStateFromValues,
  buildWitnessFunctions,
  createPlaceholderPrivateState,
  mergeWitnessSpecs,
  serializePrivateState,
  tryBuildPrivateStateFromValues,
  type PlaygroundPrivateState,
  type WitnessSpec,
} from "@/lib/playground-witnesses";
export {
  BUNDLED_DEPLOYABLE,
  bundledAssetBase,
  managedAssetBase,
  resolveAssetBase,
} from "@/lib/playground-assets";

export type ContractSlug = "hello-world" | "counter" | string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProviders = MidnightProviders<any, any, any>;

/**
 * Build Midnight providers pointed at a ZK asset base URL
 * (e.g. /contracts/hello-world or /contracts/managed/<id>).
 *
 * v1 proving is delegated to the wallet (1AM getProvingProvider) — no Docker
 * proof server on the CompactLab host.
 */
export async function createContractProviders(
  wallet: WalletConnectedAPI,
  config: NetworkConfig,
  zkConfigBasePath: string,
  storeName = "compactlabPrivateState",
): Promise<AnyProviders> {
  setNetworkId(config.networkId);

  if (typeof wallet.getProvingProvider !== "function") {
    throw new Error(
      'CompactLab v1 requires the 1AM wallet for ZK proving (wallet.getProvingProvider). Install 1AM from https://1am.xyz/ and connect it on Preprod.',
    );
  }

  const addresses = await wallet.getShieldedAddresses();
  const coinPublicKey = addresses.shieldedCoinPublicKey;

  const zkConfigBaseUrl = `${window.location.origin}${zkConfigBasePath}`;
  const zkConfigProvider = new FetchZkConfigProvider<string>(
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
  const privateStateProvider = levelPrivateStateProvider({
    privateStoragePasswordProvider: () => storagePassword,
    accountId: `${storeName}:${coinPublicKey}`,
  });

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => addresses.shieldedEncryptionPublicKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    balanceTx: async (tx: UnboundTransaction, _ttl?: Date): Promise<any> => {
      const hexUnbound = toHex(tx.serialize());
      const { tx: hexBalanced } = await wallet.balanceUnsealedTransaction(hexUnbound);
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
  } as AnyProviders;
}

/** Dynamically load a contract module from a same-origin asset base. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadContractModule(assetBase: string): Promise<any> {
  return loadBrowserContractModule(assetBase);
}

/** Witness names required by Compact-generated Contract constructor checks. */
async function detectWitnessNames(assetBase: string): Promise<string[]> {
  const url = `${window.location.origin}${assetBase}/contract/index.js`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const src = await res.text();
  const names = new Set<string>();
  const re = /typeof\s*\(\s*witnesses_0\.(\w+)\s*\)\s*!==\s*['"]function['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) names.add(m[1]);
  return [...names];
}

function privateStateBackupKey(contractAddress: string): string {
  return `compactlab:ps:${contractAddress}`;
}

function savePrivateStateBackup(contractAddress: string, state: PlaygroundPrivateState): void {
  try {
    localStorage.setItem(privateStateBackupKey(contractAddress), serializePrivateState(state));
  } catch {
    // ignore quota / private mode
  }
}

export type PlaygroundWitnessOptions = {
  /** Declared witnesses from Compact source (name + type). */
  witnessSpecs?: WitnessSpec[];
  /** User string values from Contract UI (name → input). */
  witnessValues?: Record<string, string>;
};

async function getCompiledContract(
  slug: string,
  assetBase: string,
  witnessOpts?: PlaygroundWitnessOptions,
) {
  const mod = await loadContractModule(assetBase);
  if (!mod?.Contract) {
    throw new Error(
      `Contract module at ${assetBase}/contract/index.js did not export Contract (got: ${Object.keys(mod ?? {}).join(", ") || "empty"})`,
    );
  }

  const detectedNames = await detectWitnessNames(assetBase);
  const specs = mergeWitnessSpecs(witnessOpts?.witnessSpecs ?? [], detectedNames);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let compiled: any = CompiledContract.make(slug, mod.Contract as any);

  if (specs.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CC = CompiledContract as any;
    compiled = CC.withVacantWitnesses(compiled);
    compiled = CC.withCompiledFileAssets(compiled, assetBase);
    return {
      compiledContract: compiled,
      privateStateId: undefined as string | undefined,
      witnessSpecs: specs,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CC = CompiledContract as any;
  compiled = CC.withWitnesses(compiled, buildWitnessFunctions(specs));
  compiled = CC.withCompiledFileAssets(compiled, assetBase);

  return {
    compiledContract: compiled,
    privateStateId: `compactlab:${slug}:private`,
    witnessSpecs: specs,
  };
}

function requireUserPrivateState(
  specs: WitnessSpec[],
  witnessValues: Record<string, string> | undefined,
  context: string,
): PlaygroundPrivateState {
  if (specs.length === 0) {
    throw new Error("Internal error: requireUserPrivateState called with no witnesses");
  }
  try {
    return buildPrivateStateFromValues(specs, witnessValues ?? {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${context}: ${msg}`);
  }
}

export class PlaygroundContractAPI {
  private providers: AnyProviders;
  private slug: string;
  private assetBase: string;
  private witnessOpts: PlaygroundWitnessOptions;
  private contractAddress: ContractAddress | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private foundContract: any = null;

  constructor(
    providers: AnyProviders,
    slug: string,
    assetBase: string,
    witnessOpts: PlaygroundWitnessOptions = {},
  ) {
    this.providers = providers;
    this.slug = slug;
    this.assetBase = assetBase;
    this.witnessOpts = witnessOpts;
  }

  async deploy(): Promise<{
    contractAddress: ContractAddress;
    transactionHash?: string;
    blockNumber?: number;
  }> {
    const { compiledContract, privateStateId, witnessSpecs } = await getCompiledContract(
      this.slug,
      this.assetBase,
      this.witnessOpts,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, unknown> = { compiledContract };
    let initialPrivateState: PlaygroundPrivateState | undefined;

    if (privateStateId && witnessSpecs.length > 0) {
      // Deploy runs the constructor. Witness *functions* must be wired, but values
      // are only needed if the constructor calls them (bboard does not). Official
      // example seeds random private state without prompting the user.
      initialPrivateState =
        tryBuildPrivateStateFromValues(witnessSpecs, this.witnessOpts.witnessValues) ??
        createPlaceholderPrivateState(witnessSpecs);
      options.privateStateId = privateStateId;
      options.initialPrivateState = initialPrivateState;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deployed = await (deployContract as any)(this.providers, options);
    this.contractAddress = deployed.deployTxData.public.contractAddress;
    this.foundContract = deployed;

    if (initialPrivateState && this.contractAddress) {
      savePrivateStateBackup(this.contractAddress, initialPrivateState);
    }
    if (witnessSpecs.length > 0) {
      console.info(
        `[compactlab] Deployed (witness fns wired; private values used at Call): ${witnessSpecs
          .map((s) => s.name)
          .join(", ")}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pub = deployed.deployTxData?.public as any;
    const transactionHash: string | undefined =
      pub?.txId ?? pub?.transactionHash ?? pub?.txHash ?? undefined;
    const blockNumber: number | undefined =
      typeof pub?.blockHeight === "number"
        ? pub.blockHeight
        : typeof pub?.blockNumber === "number"
          ? pub.blockNumber
          : undefined;

    return {
      contractAddress: this.contractAddress!,
      transactionHash,
      blockNumber,
    };
  }

  async join(contractAddress: ContractAddress): Promise<void> {
    const { compiledContract, privateStateId, witnessSpecs } = await getCompiledContract(
      this.slug,
      this.assetBase,
      this.witnessOpts,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, unknown> = { compiledContract, contractAddress };

    if (privateStateId && witnessSpecs.length > 0) {
      // Call-time: user must supply the private values circuits will read.
      const fromUser = requireUserPrivateState(
        witnessSpecs,
        this.witnessOpts.witnessValues,
        "Call",
      );
      options.privateStateId = privateStateId;
      options.initialPrivateState = fromUser;
      savePrivateStateBackup(contractAddress, fromUser);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await (findDeployedContract as any)(this.providers, options);
    this.contractAddress = contractAddress;
    this.foundContract = found;
  }

  /** Call an exported circuit by name with positional args derived from the args map. */
  async callCircuit(
    circuitName: string,
    args: Record<string, string>,
  ): Promise<{ txId: string }> {
    if (!this.foundContract) {
      throw new Error("Not connected to a contract. Call deploy() or join() first.");
    }
    const callTx = this.foundContract.callTx;
    if (!callTx?.[circuitName]) {
      throw new Error(`Circuit "${circuitName}" is not available on this contract.`);
    }

    const values = Object.values(args);
    let result;
    if (circuitName === "storeMessage" || circuitName === "post") {
      const msg = args["newMessage"] ?? values[0] ?? "";
      result = await callTx[circuitName](msg);
    } else if (circuitName === "increment") {
      result = await callTx.increment();
    } else if (circuitName === "incrementBy") {
      const amount = BigInt(args["amount"] ?? values[0] ?? "1");
      result = await callTx.incrementBy(amount);
    } else if (circuitName === "takeDown" || values.length === 0) {
      result = await callTx[circuitName]();
    } else {
      result = await callTx[circuitName](...values);
    }

    return { txId: result.public.txId as string };
  }

  async readLedger(): Promise<Record<string, string>> {
    if (!this.contractAddress) {
      throw new Error("Not connected to a contract.");
    }
    const states = await getPublicStates(
      this.providers.publicDataProvider,
      this.contractAddress,
    );
    const mod = await loadContractModule(this.assetBase);
    const ledger = mod.ledger(states.contractState.data) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(ledger)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "object" && v !== null) {
        // Maybe<T>
        if ("is_some" in v) {
          const maybe = v as { is_some: boolean; value: unknown };
          out[k] = maybe.is_some ? String(maybe.value) : "(none)";
          continue;
        }
        if ("toString" in v) {
          out[k] = String((v as { toString: () => string }).toString());
          continue;
        }
      }
      out[k] = String(v);
    }
    return out;
  }
}

export { PREPROD_CONFIG };
