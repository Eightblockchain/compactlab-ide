"use client";

/**
 * Hello Midnight – DApp Page
 *
 * A demonstration DApp on the Midnight Preprod network.
 *
 * Features:
 * - Deploy a hello-world contract and get a shareable contract address
 * - Join an existing deployment by pasting the contract address
 * - Read and update the on-chain message via the storeMessage circuit
 *
 * Prerequisites for users:
 * - Lace wallet browser extension (https://lace.io) with Midnight support enabled
 * - Some tDUST from the faucet: https://faucet.preprod.midnight.network/
 */

import { useState, useCallback, useEffect } from "react";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import { createHelloWorldProviders } from "@/lib/hello-midnight/providers";
import { HelloMidnightAPI } from "@/lib/hello-midnight/contract-api";
import { PREPROD_CONFIG } from "@/lib/hello-midnight/types";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

// ─── Component ────────────────────────────────────────────────────────────────

export default function HelloMidnightPage() {
  const wallet = useLaceWallet();

  const [mode, setMode] = useState<"deploy" | "join">("deploy");
  const [joinAddress, setJoinAddress] = useState("");
  const [api, setApi] = useState<HelloMidnightAPI | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const withLoading = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setIsLoading(true);
      setStatus(label);
      setError(null);
      setTxId(null);
      try {
        await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setIsLoading(false);
        setStatus("");
      }
    },
    []
  );

  async function buildAPI(connectedAPI: ConnectedAPI): Promise<HelloMidnightAPI> {
    const providers = await createHelloWorldProviders(
      connectedAPI,
      PREPROD_CONFIG
    );
    return new HelloMidnightAPI(providers);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    if (!wallet.connectedAPI) return;
    await withLoading("Deploying contract… (this may take a minute)", async () => {
      const instance = await buildAPI(wallet.connectedAPI!);
      const result = await instance.deploy();
      setApi(instance);
      setContractAddress(result.contractAddress);
      setStatus("Deployed! Reading initial state…");
      const state = await instance.readState();
      setCurrentMessage(state.message);
    });
  }, [wallet.connectedAPI, withLoading]);

  const handleJoin = useCallback(async () => {
    if (!wallet.connectedAPI || !joinAddress.trim()) return;
    await withLoading("Joining contract…", async () => {
      const instance = await buildAPI(wallet.connectedAPI!);
      await instance.join(joinAddress.trim() as `mn1${string}`);
      setApi(instance);
      setContractAddress(joinAddress.trim());
      setStatus("Joined! Reading current state…");
      const state = await instance.readState();
      setCurrentMessage(state.message);
    });
  }, [wallet.connectedAPI, joinAddress, withLoading]);

  const handleStoreMessage = useCallback(async () => {
    if (!api || !newMessage.trim()) return;
    await withLoading("Sending transaction…", async () => {
      const result = await api.storeMessage(newMessage.trim());
      setTxId(result.txId);
      setCurrentMessage(newMessage.trim());
      setNewMessage("");
    });
  }, [api, newMessage, withLoading]);

  const handleRefresh = useCallback(async () => {
    if (!api) return;
    await withLoading("Reading state…", async () => {
      const state = await api.readState();
      setCurrentMessage(state.message);
    });
  }, [api, withLoading]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#0f1117] text-white flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Hello Midnight</h1>
          <p className="mt-2 text-sm text-gray-400">
            A hello-world DApp on the Midnight Preprod network
          </p>
        </div>

        {/* Step 1 – Wallet */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-xs bg-violet-600 text-white rounded-full w-6 h-6 flex items-center justify-center">1</span>
            Connect Wallet
          </h2>

          {!wallet.isInstalled && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4 text-sm text-yellow-300">
              <p className="font-semibold">Lace wallet not detected</p>
              <p className="mt-1">
                Install the{" "}
                <a
                  href="https://lace.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-yellow-100"
                >
                  Lace wallet
                </a>{" "}
                browser extension and enable Midnight support to use this DApp.
              </p>
              <p className="mt-2 text-xs text-yellow-400">
                The wallet handles ZK proof generation locally — no Docker required.
              </p>
            </div>
          )}

          {wallet.status === "disconnected" && wallet.isInstalled && (
            <button
              onClick={wallet.connect}
              className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors font-medium"
            >
              Connect Lace Wallet
            </button>
          )}

          {wallet.status === "connecting" && (
            <p className="text-sm text-gray-400 animate-pulse">
              Connecting to wallet… please approve in the Lace extension.
            </p>
          )}

          {wallet.status === "connected" && wallet.walletInfo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-400 font-medium">Connected</span>
                <button
                  onClick={wallet.disconnect}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Disconnect
                </button>
              </div>
              <AddressRow
                label="Shielded"
                value={wallet.walletInfo.shieldedAddress}
              />
              {wallet.walletInfo.unshieldedAddress && (
                <AddressRow
                  label="Unshielded"
                  value={wallet.walletInfo.unshieldedAddress}
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                Need tDUST?{" "}
                <a
                  href="https://faucet.preprod.midnight.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-300"
                >
                  Visit the Preprod faucet
                </a>
              </p>
            </div>
          )}

          {wallet.status === "error" && (
            <ErrorBox message={wallet.error ?? "Failed to connect"} />
          )}
        </section>

        {/* Step 2 – Deploy or Join */}
        {wallet.status === "connected" && !contractAddress && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-xs bg-violet-600 text-white rounded-full w-6 h-6 flex items-center justify-center">2</span>
              Deploy or Join
            </h2>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <button
                onClick={() => setMode("deploy")}
                className={`flex-1 py-2 text-sm transition-colors ${
                  mode === "deploy"
                    ? "bg-violet-600 text-white"
                    : "bg-transparent text-gray-400 hover:text-white"
                }`}
              >
                Deploy New
              </button>
              <button
                onClick={() => setMode("join")}
                className={`flex-1 py-2 text-sm transition-colors ${
                  mode === "join"
                    ? "bg-violet-600 text-white"
                    : "bg-transparent text-gray-400 hover:text-white"
                }`}
              >
                Join Existing
              </button>
            </div>

            {mode === "deploy" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Deploy a new hello-world contract. You will receive a contract
                  address to share with others.
                </p>
                <button
                  onClick={handleDeploy}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? "Deploying…" : "Deploy Contract"}
                </button>
              </div>
            )}

            {mode === "join" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Enter a contract address to join an existing deployment.
                </p>
                <input
                  type="text"
                  value={joinAddress}
                  onChange={(e) => setJoinAddress(e.target.value)}
                  placeholder="mn1..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleJoin}
                  disabled={isLoading || !joinAddress.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? "Joining…" : "Join Contract"}
                </button>
              </div>
            )}

            {/* Status + errors during deploy/join */}
            {isLoading && status && (
              <p className="text-sm text-violet-300 animate-pulse">{status}</p>
            )}
            {error && <ErrorBox message={error} />}
          </section>
        )}

        {/* Step 3 – Interact */}
        {contractAddress && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-xs bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center">3</span>
              Interact
            </h2>

            {/* Contract address */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Contract Address</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-emerald-300 font-mono break-all">
                  {contractAddress}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(contractAddress)}
                  className="shrink-0 text-xs text-gray-500 hover:text-white border border-white/10 rounded px-2 py-1 transition-colors"
                  title="Copy address"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Share this address so others can join the same contract.
              </p>
            </div>

            {/* Current message */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  On-chain Message
                </p>
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 min-h-[48px]">
                {currentMessage ? (
                  <p className="text-sm">{currentMessage}</p>
                ) : (
                  <p className="text-sm text-gray-600 italic">
                    No message stored yet
                  </p>
                )}
              </div>
            </div>

            {/* Store new message */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Store New Message
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !isLoading && handleStoreMessage()
                  }
                  placeholder="Type a message…"
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleStoreMessage}
                  disabled={isLoading || !newMessage.trim()}
                  className="shrink-0 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  {isLoading ? "…" : "Send"}
                </button>
              </div>
            </div>

            {/* Tx status */}
            {isLoading && status && (
              <p className="text-sm text-violet-300 animate-pulse">{status}</p>
            )}
            {txId && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
                <p className="text-xs text-emerald-300">
                  <span className="font-semibold">Transaction submitted</span>
                  {txId.length > 12 && (
                    <span className="ml-2 font-mono opacity-70">
                      {txId.slice(0, 16)}…
                    </span>
                  )}
                </p>
              </div>
            )}
            {error && <ErrorBox message={error} />}

            {/* Reset */}
            <button
              onClick={() => {
                setContractAddress(null);
                setApi(null);
                setCurrentMessage("");
                setError(null);
                setTxId(null);
              }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Deploy or join a different contract
            </button>
          </section>
        )}

        {/* Info card */}
        <section className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-400">About this DApp</p>
          <p>Network: Midnight Preprod</p>
          <p>
            Contract:{" "}
            <code className="font-mono">hello-world.compact</code> — stores a
            single public string on-chain
          </p>
          <p>
            Proofs: handled by the Lace wallet extension — no Docker required
          </p>
        </section>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-gray-500 w-20 shrink-0">{label}:</span>
      <code className="font-mono text-gray-300 break-all">{value}</code>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
      <p className="text-sm text-red-300">{message}</p>
    </div>
  );
}
