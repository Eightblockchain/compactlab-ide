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
import type {
  FinalizedTransaction,
  TransactionId,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
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
  witnessSpecsForNames,
  type PlaygroundPrivateState,
  type WitnessSpec,
} from "@/lib/playground-witnesses";
import {
  encodeCompactParams,
  parseInitialStateParamsFromDts,
  validateCompactParams,
} from "@/lib/compact-values";
import { toAbsoluteAssetUrl } from "@/lib/playground-assets";
import { formatCompactRuntimeValue, formatLedgerSnapshot } from "@/lib/compact-runtime-format";
import { apiFetch } from "@/lib/api";
import type { FeeMode } from "@/lib/fee-mode";
export {
  BUNDLED_DEPLOYABLE,
  bundledAssetBase,
  managedAssetBase,
  resolveAssetBase,
  toAbsoluteAssetUrl,
} from "@/lib/playground-assets";

export type ContractSlug = "hello-world" | "counter" | string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProviders = MidnightProviders<any, any, any>;

export type CreateContractProvidersOptions = {
  storeName?: string;
  /** v1 default is self-pay. Sponsored uses CompactLab Dust when enabled. */
  feeMode?: FeeMode;
  /** Sent with sponsored submits so the API can log the spend per project. */
  projectId?: string | null;
};

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
  storeNameOrOptions: string | CreateContractProvidersOptions = "compactlabPrivateState",
): Promise<AnyProviders> {
  const options: CreateContractProvidersOptions =
    typeof storeNameOrOptions === "string"
      ? { storeName: storeNameOrOptions }
      : storeNameOrOptions;
  const storeName = options.storeName ?? "compactlabPrivateState";
  const feeMode: FeeMode = options.feeMode ?? "self";

  setNetworkId(config.networkId);

  if (typeof wallet.getProvingProvider !== "function") {
    throw new Error(
      `CompactLab v1 requires the 1AM wallet for ZK proving (wallet.getProvingProvider). Install 1AM from https://1am.xyz/ and connect it on ${config.networkId === "preview" ? "Preview" : "Preprod"}.`,
    );
  }

  const addresses = await wallet.getShieldedAddresses();
  const coinPublicKey = addresses.shieldedCoinPublicKey;

  const zkConfigBaseUrl = toAbsoluteAssetUrl(zkConfigBasePath);
  const zkConfigProvider = new FetchZkConfigProvider<string>(
    zkConfigBaseUrl,
    (url: string | Request | URL, init?: RequestInit) => window.fetch(url, init),
  );

  const proofProvider = await dappConnectorProofProvider(
    wallet,
    zkConfigProvider,
    CostModel.initialCostModel(),
  );

  const { getIndexerEndpoints } = await import("@/lib/indexer-endpoints");
  const { networkInfoFor } = await import("@/lib/network");
  const indexer = await getIndexerEndpoints(networkInfoFor(config.networkId));
  const publicDataProvider = indexerPublicDataProvider(indexer.indexerUri, indexer.indexerWsUri);

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
      if (feeMode === "sponsored") {
        // 1AM ignores { payFees: false } and adds its own DUST fee, leaving the
        // sponsor nothing to pay. A tx that moves no tokens needs no wallet
        // balancing, so seal it here; the sponsor adds the fee.
        if (movesTokens(tx)) {
          throw new Error(
            "This transaction moves shielded or unshielded tokens, which only your wallet can balance. Switch fee mode to Self-pay.",
          );
        }
        return tx.bind();
      }
      const hexUnbound = toHex(tx.serialize());
      const { tx: hexBalanced } = await wallet.balanceUnsealedTransaction(
        hexUnbound,
        { payFees: true },
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
          json: { tx: hexFinalized, projectId: options.projectId ?? undefined },
        });
        const text = await res.text();
        let body: { txId?: string; error?: string; success?: boolean } = {};
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
  } as AnyProviders;
}

/** True when any segment has a non-DUST imbalance (token inputs or outputs). */
export function movesTokens(tx: Pick<UnboundTransaction, "imbalances" | "intents">): boolean {
  const segments = [0, ...(tx.intents?.keys() ?? [])];
  return segments.some((segment) =>
    [...tx.imbalances(segment).entries()].some(([token, value]) => token.tag !== "dust" && value !== BigInt(0)),
  );
}

/** Dynamically load a contract module from a same-origin asset base. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadContractModule(assetBase: string): Promise<any> {
  return loadBrowserContractModule(assetBase);
}

/** Witness names required by Compact-generated Contract constructor checks. */
async function detectWitnessNames(assetBase: string): Promise<string[]> {
  const url = `${toAbsoluteAssetUrl(assetBase)}/contract/index.js?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const src = await res.text();
  const names = new Set<string>();
  const re = /typeof\s*\(\s*witnesses_0\.(\w+)\s*\)\s*!==\s*['"]function['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) names.add(m[1]!);
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
  /** Compact constructor parameter specs (declaration order). */
  constructorParams?: Array<{ name: string; type: string }>;
  /** User string values for constructor args. */
  constructorValues?: Record<string, string>;
  /**
   * When true, deploy requires real witness values for names in
   * `requiredWitnessNamesAtDeploy` (constructor-called witnesses only).
   * Other declared witnesses still get placeholders — they run on later circuits.
   */
  requireWitnessValuesAtDeploy?: boolean;
  /** Witness names the constructor body actually calls (subset of declared witnesses). */
  requiredWitnessNamesAtDeploy?: string[];
  /**
   * Witness names the circuit being Called actually uses.
   * When set, join/Call only requires those values; others get placeholders.
   * When omitted, all declared witnesses are required (legacy).
   */
  requiredWitnessNamesAtCall?: string[];
  /** Enum/struct decls from Compact source for JSON composite encoding. */
  typeEnv?: import("@/lib/compact-values").CompactTypeEnv;
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

async function fetchGeneratedDts(assetBase: string): Promise<string | null> {
  try {
    const url = `${toAbsoluteAssetUrl(assetBase)}/contract/index.d.ts`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function resolveDeployConstructorParams(
  assetBase: string,
  fromOpts: Array<{ name: string; type: string }> | undefined,
): Promise<Array<{ name: string; type: string }>> {
  const dts = await fetchGeneratedDts(assetBase);
  const fromDts = dts ? parseInitialStateParamsFromDts(dts) : [];
  // Prefer source/UI specs when arity matches (better Compact type strings).
  if (fromOpts && fromOpts.length > 0) {
    if (fromDts.length === 0 || fromDts.length === fromOpts.length) return fromOpts;
    // Arity mismatch: trust generated artifacts (what deploy will invoke).
    return fromDts;
  }
  return fromDts;
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

    const constructorParams = await resolveDeployConstructorParams(
      this.assetBase,
      this.witnessOpts.constructorParams,
    );
    const constructorValues = this.witnessOpts.constructorValues ?? {};

    if (constructorParams.length > 0) {
      const ctorErr = validateCompactParams(
        constructorParams,
        constructorValues,
        "Constructor parameter",
        this.witnessOpts.typeEnv,
      );
      if (ctorErr) throw new Error(ctorErr);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, unknown> = { compiledContract };
    let initialPrivateState: PlaygroundPrivateState | undefined;

    if (privateStateId && witnessSpecs.length > 0) {
      if (this.witnessOpts.requireWitnessValuesAtDeploy) {
        // Only constructor-referenced witnesses need real values at Deploy.
        // Remaining witness slots get placeholders until a later circuit Call.
        const requiredNames = this.witnessOpts.requiredWitnessNamesAtDeploy ?? [];
        const requiredSpecs =
          requiredNames.length > 0
            ? witnessSpecsForNames(witnessSpecs, requiredNames)
            : witnessSpecs;
        const requiredNameSet = new Set(requiredSpecs.map((s) => s.name));
        const optionalSpecs = witnessSpecs.filter((s) => !requiredNameSet.has(s.name));

        const requiredState = requireUserPrivateState(
          requiredSpecs,
          this.witnessOpts.witnessValues,
          "Deploy (constructor uses these witnesses)",
        );
        const placeholderState = createPlaceholderPrivateState(optionalSpecs);
        initialPrivateState = { ...placeholderState, ...requiredState };
      } else {
        initialPrivateState =
          tryBuildPrivateStateFromValues(witnessSpecs, this.witnessOpts.witnessValues) ??
          createPlaceholderPrivateState(witnessSpecs);
      }
      options.privateStateId = privateStateId;
      options.initialPrivateState = initialPrivateState;
    }

    if (constructorParams.length > 0) {
      options.args = encodeCompactParams(
        constructorParams,
        constructorValues,
        this.witnessOpts.typeEnv,
      );
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
        `[compactlab] Deployed (witness fns wired): ${witnessSpecs.map((s) => s.name).join(", ")}`,
      );
    }
    if (constructorParams.length > 0) {
      console.info(
        `[compactlab] Constructor args: ${constructorParams.map((p) => p.name).join(", ")}`,
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
      const requiredNames = this.witnessOpts.requiredWitnessNamesAtCall;
      let privateState: PlaygroundPrivateState;
      if (requiredNames) {
        const requiredSpecs = witnessSpecsForNames(witnessSpecs, requiredNames);
        const requiredNameSet = new Set(requiredSpecs.map((s) => s.name));
        const optionalSpecs = witnessSpecs.filter((s) => !requiredNameSet.has(s.name));
        const requiredState =
          requiredSpecs.length > 0
            ? requireUserPrivateState(
                requiredSpecs,
                this.witnessOpts.witnessValues,
                "Call (this circuit uses these witnesses)",
              )
            : {};
        const placeholderState = createPlaceholderPrivateState(optionalSpecs);
        privateState = { ...placeholderState, ...requiredState };
      } else {
        privateState = requireUserPrivateState(
          witnessSpecs,
          this.witnessOpts.witnessValues,
          "Call",
        );
      }
      options.privateStateId = privateStateId;
      options.initialPrivateState = privateState;
      savePrivateStateBackup(contractAddress, privateState);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await (findDeployedContract as any)(this.providers, options);
    this.contractAddress = contractAddress;
    this.foundContract = found;
  }

  /**
   * Call an exported circuit by name.
   * `paramSpecs` should match Compact declaration order; values are typed-encoded.
   */
  async callCircuit(
    circuitName: string,
    args: Record<string, string>,
    paramSpecs: Array<{ name: string; type: string }> = [],
  ): Promise<PlaygroundCallResult> {
    if (!this.foundContract) {
      throw new Error("Not connected to a contract. Call deploy() or join() first.");
    }
    const callTx = this.foundContract.callTx;
    if (!callTx?.[circuitName]) {
      throw new Error(`Circuit "${circuitName}" is not available on this contract.`);
    }

    const encoded =
      paramSpecs.length === 0
        ? []
        : encodeCompactParams(paramSpecs, args, this.witnessOpts.typeEnv);

    const result = await callTx[circuitName](...encoded);
    const pub = result.public as {
      txId?: string;
      txHash?: string;
      status?: string;
      blockHeight?: number;
    };
    const rawReturn = result.private?.result;
    return {
      txId: String(pub.txId ?? ""),
      txHash: pub.txHash ? String(pub.txHash) : undefined,
      status: pub.status != null ? String(pub.status) : undefined,
      blockHeight: typeof pub.blockHeight === "number" ? pub.blockHeight : undefined,
      returnValue: formatCompactRuntimeValue(rawReturn),
    };
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
    return formatLedgerSnapshot(ledger);
  }
}

export type PlaygroundCallResult = {
  txId: string;
  txHash?: string;
  status?: string;
  blockHeight?: number;
  returnValue: string;
};

export { PREPROD_CONFIG };
