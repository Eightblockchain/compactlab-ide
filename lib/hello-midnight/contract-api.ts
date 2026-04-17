/**
 * hello-midnight – Contract API
 *
 * Wraps deployContract / findDeployedContract / callTx from the Midnight SDK.
 * This is the main entry point for DApp interactions with the hello-world contract.
 *
 * Usage:
 *   const api = new HelloMidnightAPI(providers);
 *   const { contractAddress } = await api.deploy();
 *   await api.storeMessage("Hello, Midnight!");
 *   const { message } = await api.readState();
 *
 *   // Share `contractAddress` with other users who can then join:
 *   const api2 = new HelloMidnightAPI(providers);
 *   await api2.join(contractAddress);
 *   await api2.storeMessage("Reply from another user");
 */

import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import type { HelloWorldState } from "./types";
import { type HelloWorldProviders } from "./providers";

// ─── Compiled contract singleton ─────────────────────────────────────────────

// Lazily loaded to avoid SSR issues — the contract module uses compact-runtime WASM.
// Cached as a Promise so the dynamic import only fires once.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _modulePromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadContractModule(): Promise<any> {
  if (!_modulePromise) {
    _modulePromise = import(
      "../../public/contracts/hello-world/contract/index.js"
    );
  }
  return _modulePromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _compiledContract: any | null = null;

async function getCompiledContract() {
  if (!_compiledContract) {
    const HelloWorldModule = await loadContractModule();
    // hello-world has no private state. Cast to `any` to satisfy the generic
    // variance in CompiledContract.make<C extends Contract<PS>>.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _compiledContract = CompiledContract.make("hello-world", HelloWorldModule.Contract as any).pipe(
      CompiledContract.withVacantWitnesses,
      CompiledContract.withCompiledFileAssets("/contracts/hello-world")
    );
  }
  return _compiledContract;
}

// ─── Contract API class ───────────────────────────────────────────────────────

export class HelloMidnightAPI {
  private providers: HelloWorldProviders;
  private contractAddress: ContractAddress | null = null;
  // The FoundContract holds the callTx interface returned by find/deploy
  private foundContract: Awaited<
    ReturnType<typeof findDeployedContract>
  > | null = null;

  constructor(providers: HelloWorldProviders) {
    this.providers = providers;
  }

  /**
   * Deploys a fresh hello-world contract to Midnight Preprod.
   * Returns the contract address to share with other users.
   *
   * Note: The first call to storeMessage will set the initial message.
   * The default message is an empty string (Opaque<"string"> default).
   */
  async deploy(): Promise<{ contractAddress: ContractAddress }> {
    const compiledContract = await getCompiledContract();

    // Cast required: CompiledContract<Contract<never>> is not assignable to
    // CompiledContract<Contract<undefined>> due to TypeScript variance on PS.
    // Runtime behavior is correct — the contract has no private state.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deployed = await (deployContract as any)(this.providers, {
      compiledContract,
    }) as Awaited<ReturnType<typeof deployContract>>;

    this.contractAddress = deployed.deployTxData.public.contractAddress;
    this.foundContract = deployed;

    return { contractAddress: this.contractAddress };
  }

  /**
   * Joins an already-deployed hello-world contract by its address.
   * Use this to interact with a contract deployed by another user.
   *
   * @param contractAddress - The address returned by the deployer's `deploy()` call
   */
  async join(contractAddress: ContractAddress): Promise<void> {
    const compiledContract = await getCompiledContract();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await (findDeployedContract as any)(this.providers, {
      compiledContract,
      contractAddress,
    }) as Awaited<ReturnType<typeof findDeployedContract>>;

    this.contractAddress = contractAddress;
    this.foundContract = found;
  }

  /**
   * Calls the `storeMessage` circuit to update the on-chain message.
   * Requires deploy() or join() to have been called first.
   *
   * @param newMessage - The new message to store on-chain
   */
  async storeMessage(newMessage: string): Promise<{ txId: string }> {
    if (!this.foundContract) {
      throw new Error("Not connected to a contract. Call deploy() or join() first.");
    }

    const result = await this.foundContract.callTx.storeMessage(newMessage);
    return { txId: result.public.txId };
  }

  /**
   * Reads the current on-chain state of the contract.
   * Does NOT require a wallet — reads directly from the indexer.
   *
   * @returns The current ledger state (message field)
   */
  async readState(): Promise<HelloWorldState> {
    if (!this.contractAddress) {
      throw new Error("Not connected to a contract. Call deploy() or join() first.");
    }

    const { getPublicStates } = await import(
      "@midnight-ntwrk/midnight-js-contracts"
    );

    const states = await getPublicStates(
      this.providers.publicDataProvider,
      this.contractAddress
    );

    // states.contractState.data contains the ledger state
    // The hello-world ledger has one field: message: Opaque<"string">
    const HelloWorldModule = await loadContractModule();
    const ledger = HelloWorldModule.ledger(states.contractState.data);

    return { message: ledger.message ?? "" };
  }

  get address(): ContractAddress | null {
    return this.contractAddress;
  }

  get isConnected(): boolean {
    return this.foundContract !== null;
  }
}
