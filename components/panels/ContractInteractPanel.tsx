"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIDEStore } from "@/store/ide";
import { Badge, Button, StatusDot } from "@/components/ui";
import { extractCircuits, extractLedgerVars, extractWitnesses } from "@/lib/compact";
import { circuitWitnessUsage } from "@/lib/compact-constructor";
import { cn, generateId } from "@/lib/utils";
import {
  useLaceWallet,
  isWalletSessionExpiredMessage,
  WALLET_SESSION_EXPIRED_MSG,
} from "@/hooks/useLaceWallet";
import { getDeployGate, getLiveCompactSource } from "@/lib/deploy-gate";
import { isOutdatedManagedArtifactUrl, OUTDATED_ARTIFACT_MESSAGE } from "@/lib/playground-assets";
import { oneAmContractUrl, oneAmTxUrl } from "@/lib/explorers";
import {
  validateWitnessValues,
  witnessSpecsForNames,
} from "@/lib/playground-witnesses";
import {
  typeEnvFromCompactSource,
  validateCompactParams,
} from "@/lib/compact-values";
import { isVoidCircuitOutput } from "@/lib/compact-runtime-format";
import { normalizeFeeMode } from "@/lib/fee-mode";
import {
  PanelEmpty,
  PanelHint,
  PanelSection,
} from "@/components/panels/inspector-chrome";
import {
  CompactValueInputRow,
  WitnessInputRow,
} from "@/components/panels/compact-value-inputs";

interface CircuitCallResult {
  success: boolean;
  message: string;
  txId?: string;
  txHash?: string;
  status?: string;
  blockHeight?: number;
  returnValue?: string;
}

interface IndexerResponse {
  data?: {
    contractAction?: {
      address: string;
      state: string;
      transaction?: { hash: string; block?: { height: number } };
    };
  };
}

export function ContractInteractPanel() {
  const {
    deployResult,
    compileResult,
    code,
    status,
    activeProject,
    activeFileId,
    tabBuffers,
    addLog,
    clearLogs,
    setLogTab,
    setBottomPanelOpen,
    witnessValues,
    setWitnessValue,
    saveContractAddress,
  } = useIDEStore();
  const lace = useLaceWallet();

  const liveCompact = useMemo(
    () =>
      getLiveCompactSource({
        files: activeProject?.files ?? [],
        activeFileId,
        code,
        tabBuffers,
      }),
    [activeProject?.files, activeFileId, code, tabBuffers],
  );
  const witnesses = useMemo(() => extractWitnesses(liveCompact), [liveCompact]);
  const typeEnv = useMemo(() => typeEnvFromCompactSource(liveCompact), [liveCompact]);
  const ledgerVars = useMemo(() => extractLedgerVars(liveCompact), [liveCompact]);

  const circuits = useMemo(() => {
    const fromCompile = compileResult?.circuitMetadata ?? [];
    const list =
      fromCompile.length > 0 ? fromCompile : extractCircuits(liveCompact);
    return list.filter((c) => c.isExported !== false);
  }, [compileResult?.circuitMetadata, liveCompact]);

  const [addressInput, setAddressInput] = useState(deployResult?.contractAddress ?? "");
  const [activeAddress, setActiveAddress] = useState(deployResult?.contractAddress ?? "");
  const [joinOpen, setJoinOpen] = useState(false);
  const [witnessOpen, setWitnessOpen] = useState(false);
  const [selectedCircuit, setSelectedCircuit] = useState<string | null>(null);

  useEffect(() => {
    if (deployResult?.contractAddress) {
      setAddressInput(deployResult.contractAddress);
      setActiveAddress(deployResult.contractAddress);
    }
  }, [deployResult?.contractAddress]);

  useEffect(() => {
    if (!selectedCircuit && circuits[0]) setSelectedCircuit(circuits[0].name);
    if (selectedCircuit && !circuits.some((c) => c.name === selectedCircuit) && circuits[0]) {
      setSelectedCircuit(circuits[0].name);
    }
  }, [circuits, selectedCircuit]);

  const selected = circuits.find((c) => c.name === selectedCircuit) ?? circuits[0];

  const requiredWitnessNames = useMemo(() => {
    if (!selected) return [] as string[];
    return circuitWitnessUsage(
      liveCompact,
      selected.name,
      witnesses.map((w) => w.name),
    ).witnessNamesUsed;
  }, [liveCompact, selected, witnesses]);

  const requiredWitnessSpecs = useMemo(
    () => witnessSpecsForNames(witnesses, requiredWitnessNames),
    [witnesses, requiredWitnessNames],
  );

  const witnessErr = validateWitnessValues(requiredWitnessSpecs, witnessValues);
  const requiredWitnessNameSet = useMemo(
    () => new Set(requiredWitnessNames),
    [requiredWitnessNames],
  );

  useEffect(() => {
    if (witnessErr) setWitnessOpen(true);
  }, [witnessErr, selected?.name]);

  const [decodedState, setDecodedState] = useState<Record<string, string> | null>(null);
  const [lastTx, setLastTx] = useState<{ hash: string; blockHeight: number | null } | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  const fetchState = useCallback(
    async (addr: string) => {
      if (!addr.trim()) return;
      setStateLoading(true);
      setStateError(null);
      try {
        if (isOutdatedManagedArtifactUrl(activeProject?.artifactBaseUrl)) {
          setDecodedState(null);
          setStateError(OUTDATED_ARTIFACT_MESSAGE);
        } else if (activeProject?.template || activeProject?.artifactBaseUrl) {
          const { readPlaygroundState } = await import("@/lib/playground-call");
          try {
            const snapshot = await readPlaygroundState(activeProject.template, addr, {
              artifactBaseUrl: activeProject.artifactBaseUrl,
            });
            setDecodedState(snapshot);
            setStateError(null);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Could not decode ledger";
            setDecodedState(null);
            setStateError(message);
          }
        }
        const { apiFetch } = await import("@/lib/api");
        const res = await apiFetch("/v1/indexer", {
          method: "POST",
          json: {
            query: `{ contractAction(address: "${addr}") { address state transaction { hash block { height } } } }`,
          },
        });
        const json = (await res.json()) as IndexerResponse;
        const action = json.data?.contractAction;
        if (action?.transaction?.hash) {
          setLastTx({
            hash: action.transaction.hash,
            blockHeight: action.transaction.block?.height ?? null,
          });
        } else if (!action) {
          setLastTx(null);
        }
      } catch (err) {
        setStateError((prev) => prev ?? (err instanceof Error ? err.message : "Indexer unreachable"));
      } finally {
        setStateLoading(false);
      }
    },
    [activeProject?.template, activeProject?.artifactBaseUrl],
  );

  useEffect(() => {
    if (activeAddress) void fetchState(activeAddress);
  }, [activeAddress, fetchState]);

  const [circuitInputs, setCircuitInputs] = useState<Record<string, Record<string, string>>>({});
  const [lastResult, setLastResult] = useState<CircuitCallResult | null>(null);
  const [callingCircuit, setCallingCircuit] = useState<string | null>(null);

  const template = activeProject?.template ?? "";
  const deployGate = getDeployGate({
    template,
    artifactBaseUrl: activeProject?.artifactBaseUrl,
    compiledSourceHash: activeProject?.compiledSourceHash,
    currentSource: liveCompact,
  });
  const canCallOnChain =
    !!lace.connectedAPI && !!activeAddress && deployGate.canDeploy && !witnessErr;

  const callBlockedReason = !activeAddress
    ? "Deploy from the toolbar to get a contract address."
    : !lace.connectedAPI
      ? "Connect 1AM to send transactions."
      : !deployGate.canDeploy
        ? deployGate.reason
        : witnessErr
          ? witnessErr
          : null;

  const handleLoadAddress = (addrOverride?: string) => {
    const addr = (addrOverride ?? addressInput).trim();
    if (!addr) return;
    setAddressInput(addr);
    setActiveAddress(addr);
    setLastResult(null);
    saveContractAddress(addr);
  };

  const refreshUntilSettled = useCallback(
    async (addr: string) => {
      for (const wait of [1500, 3000, 5000]) {
        await new Promise((r) => setTimeout(r, wait));
        await fetchState(addr);
      }
    },
    [fetchState],
  );

  const handleCall = useCallback(async () => {
    if (!selected || callingCircuit) return;

    if (!canCallOnChain) {
      addLog({
        id: generateId(),
        timestamp: Date.now(),
        level: "error",
        message: callBlockedReason ?? "On-chain call unavailable.",
        source: "network",
      });
      setLastResult({
        success: false,
        message: callBlockedReason ?? "On-chain call unavailable.",
      });
      return;
    }

    const inputs = circuitInputs[selected.name] ?? {};
    const argErr = validateCompactParams(selected.inputs, inputs, "Circuit argument", typeEnv);
    if (argErr) {
      addLog({
        id: generateId(),
        timestamp: Date.now(),
        level: "error",
        message: argErr,
        source: "network",
      });
      setLastResult({ success: false, message: argErr });
      return;
    }

    setCallingCircuit(selected.name);
    clearLogs();
    setLogTab("network");
    setBottomPanelOpen(true);

    try {
      const liveApi = await lace.ensureSession();
      if (!liveApi) {
        const msg =
          lace.error && isWalletSessionExpiredMessage(lace.error)
            ? lace.error
            : WALLET_SESSION_EXPIRED_MSG;
        addLog({
          id: generateId(),
          timestamp: Date.now(),
          level: "warn",
          message: `${msg} Reconnect 1AM, then try the circuit again.`,
          source: "network",
        });
        setLastResult({ success: false, message: msg });
        setCallingCircuit(null);
        return;
      }

      const { callPlaygroundCircuit } = await import("@/lib/playground-call");
      const feeMode = normalizeFeeMode(useIDEStore.getState().feeMode);
      if (feeMode === "self" && lace.dustBalance?.isEmpty) {
        const msg =
          "Your tDUST balance is 0. Fund tNIGHT at https://faucet.preprod.midnight.network/ and wait for Dust generation.";
        addLog({
          id: generateId(),
          timestamp: Date.now(),
          level: "error",
          message: msg,
          source: "network",
        });
        setLastResult({ success: false, message: msg });
        setCallingCircuit(null);
        return;
      }
      const result = await callPlaygroundCircuit(
        liveApi,
        activeProject!.template,
        activeAddress,
        selected.name,
        inputs,
        addLog,
        {
          artifactBaseUrl: activeProject?.artifactBaseUrl,
          projectId: activeProject?.id,
          witnessSpecs: witnesses,
          witnessValues,
          requiredWitnessNames,
          circuitParams: selected.inputs,
          typeEnv,
          feeMode,
        },
      );
      setLastResult({
        success: true,
        message: result.status ? `Confirmed (${result.status})` : "Confirmed on Preprod",
        txId: result.txId,
        txHash: result.txHash,
        status: result.status,
        blockHeight: result.blockHeight,
        returnValue: result.returnValue,
      });
      await fetchState(activeAddress);
      void refreshUntilSettled(activeAddress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isWalletSessionExpiredMessage(msg)) {
        lace.markSessionExpired(WALLET_SESSION_EXPIRED_MSG);
        setLastResult({
          success: false,
          message: "1AM connection expired. Reconnect, then try again.",
        });
      } else {
        setLastResult({ success: false, message: msg });
        addLog({
          id: generateId(),
          timestamp: Date.now(),
          level: "error",
          message: `Circuit call failed: ${msg}`,
          source: "network",
        });
      }
    }

    setCallingCircuit(null);
  }, [
    selected,
    callingCircuit,
    circuitInputs,
    canCallOnChain,
    callBlockedReason,
    lace,
    activeProject,
    activeAddress,
    witnesses,
    requiredWitnessNames,
    witnessValues,
    typeEnv,
    addLog,
    clearLogs,
    setLogTab,
    setBottomPanelOpen,
    fetchState,
    refreshUntilSettled,
  ]);

  if (!activeAddress) {
    return (
      <div className="p-4 space-y-5 animate-[fade-in_0.15s_ease-out]">
        <PanelEmpty
          title="No contract on chain yet"
          detail="Compile (ZK), then use Deploy in the toolbar. Deploy publishes a permanent Preprod address. This panel reads ledger state and sends circuit calls through 1AM."
        />
        {witnesses.length > 0 && (
          <PanelSection title="Private witnesses">
            <p className="text-2xs text-text-muted leading-relaxed mb-2">
              Only circuits that call a witness need its value. You can fill them when you Call those circuits.
            </p>
            <div className="space-y-2">
              {witnesses.map((w) => (
                <WitnessInputRow
                  key={w.name}
                  name={w.name}
                  type={w.type}
                  value={witnessValues[w.name] ?? ""}
                  onChange={(val) => setWitnessValue(w.name, val)}
                />
              ))}
            </div>
          </PanelSection>
        )}
        <JoinAnother
          open={joinOpen}
          onToggle={() => setJoinOpen((v) => !v)}
          addressInput={addressInput}
          setAddressInput={setAddressInput}
          onLoad={handleLoadAddress}
          savedAddress={deployResult?.contractAddress}
        />
      </div>
    );
  }

  const ledgerEntries =
    decodedState && Object.keys(decodedState).length > 0
      ? Object.entries(decodedState)
      : [];
  const exportedLedgerVars = ledgerVars.filter((v) => v.isExported);
  const privateLedgerVars = ledgerVars.filter((v) => !v.isExported);
  const showExportHint =
    !stateLoading &&
    !stateError &&
    ledgerEntries.length === 0 &&
    privateLedgerVars.length > 0;

  return (
    <div className="p-3 space-y-4 animate-[fade-in_0.15s_ease-out]">
      {(isOutdatedManagedArtifactUrl(activeProject?.artifactBaseUrl) ||
        deployGate.reason === OUTDATED_ARTIFACT_MESSAGE ||
        stateError === OUTDATED_ARTIFACT_MESSAGE) && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 space-y-1">
          <p className="text-xs font-medium text-warning">Compile artifacts outdated</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            {OUTDATED_ARTIFACT_MESSAGE}
          </p>
        </div>
      )}
      <div className="rounded-lg border border-border/80 bg-white/[0.02] px-3 py-2.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              On-chain contract
            </p>
            <a
              href={oneAmContractUrl(activeAddress)}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block text-xs font-mono text-accent hover:underline truncate"
              title={activeAddress}
            >
              {activeAddress.slice(0, 18)}…{activeAddress.slice(-10)}
            </a>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="info" size="sm">
              preprod
            </Badge>
            <button
              type="button"
              onClick={() => void fetchState(activeAddress)}
              disabled={stateLoading}
              className="text-text-dim hover:text-text-muted disabled:opacity-40"
              title="Refresh on-chain state"
            >
              <svg
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                className={cn("w-3.5 h-3.5", stateLoading && "animate-spin")}
              >
                <path d="M10 6A4 4 0 1 1 6.5 2.1" strokeLinecap="round" />
                <path d="M8 1.5l1.5 1-1 1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        {!lace.connectedAPI && (
          <Button size="sm" variant="accent" onClick={() => void lace.connect()}>
            Connect 1AM
          </Button>
        )}
      </div>

      <PanelSection
        title="Public ledger"
        action={
          <StatusDot status={decodedState ? "success" : stateError ? "error" : "idle"} />
        }
      >
        {stateLoading && !decodedState && (
          <p className="text-xs text-text-muted py-1">Reading indexer…</p>
        )}
        {stateError && !decodedState && (
          <div className="rounded-md border border-warning/30 bg-warning/8 px-2.5 py-2 space-y-1">
            <p className="text-xs text-warning leading-relaxed">{stateError}</p>
          </div>
        )}
        {!stateLoading && !stateError && ledgerEntries.length === 0 && !showExportHint && (
          <p className="text-2xs text-text-dim">
            {ledgerVars.length === 0
              ? "No public ledger fields on this contract."
              : exportedLedgerVars.length === 0
                ? "No exported ledger fields to display."
                : "No ledger values from the indexer yet. Refresh in a few seconds."}
          </p>
        )}
        {showExportHint && (
          <div className="rounded-md border border-border/70 bg-white/[0.02] px-2.5 py-2 space-y-1.5">
            <p className="text-xs text-text-secondary leading-relaxed">
              On-chain ledger fields exist, but none are exported for TypeScript reads. Compact only
              exposes fields declared as{" "}
              <span className="font-mono text-text-primary">export ledger …</span> via{" "}
              <span className="font-mono text-text-primary">ledger()</span>.
            </p>
            <p className="text-2xs text-text-dim leading-relaxed">
              Not exported: {privateLedgerVars.map((v) => v.name).join(", ")}. Add{" "}
              <span className="font-mono">export</span> before each{" "}
              <span className="font-mono">ledger</span>, Compile (ZK), and Deploy again to inspect
              values here.
            </p>
          </div>
        )}
        {!stateError && ledgerEntries.length > 0 && (
          <div className="space-y-1.5">
            {ledgerEntries.map(([name, value]) => {
              const type = ledgerVars.find((v) => v.name === name)?.type;
              return (
                <div
                  key={name}
                  className="rounded-md border border-border/70 bg-white/[0.02] px-2.5 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-mono text-text-primary">{name}</span>
                    {type && <span className="text-2xs font-mono text-text-dim truncate">{type}</span>}
                  </div>
                  <pre className="mt-1 text-xs font-mono text-success whitespace-pre-wrap break-all max-h-36 overflow-y-auto">
                    {value}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
        {lastTx?.hash && (
          <a
            href={oneAmTxUrl(lastTx.hash)}
            target="_blank"
            rel="noreferrer"
            className="block text-2xs text-text-muted hover:text-accent truncate"
          >
            Last indexer tx {lastTx.hash.slice(0, 18)}…
            {lastTx.blockHeight != null ? ` · block ${lastTx.blockHeight}` : ""}
          </a>
        )}
      </PanelSection>

      {witnesses.length > 0 && (
        <PanelSection
          title="Private witnesses"
          action={
            <button
              type="button"
              className="text-2xs text-text-muted hover:text-text-primary"
              onClick={() => setWitnessOpen((v) => !v)}
            >
              {witnessOpen
                ? "Hide"
                : witnessErr
                  ? "Needed"
                  : requiredWitnessNames.length > 0
                    ? `${requiredWitnessNames.length} for Call`
                    : "Show"}
            </button>
          }
        >
          {witnessOpen && (
            <div className="space-y-2">
              <p className="text-2xs text-text-muted leading-relaxed">
                {selected
                  ? requiredWitnessNames.length > 0
                    ? `${selected.name} needs: ${requiredWitnessNames.join(", ")}. Other witnesses wait until a circuit that calls them runs.`
                    : `${selected.name} does not call private witnesses — values not required for this Call.`
                  : "Off-chain secrets used inside proofs."}
              </p>
              {witnesses.map((w) => {
                const needed = requiredWitnessNameSet.has(w.name);
                return (
                  <div key={w.name} className={cn(!needed && "opacity-55")}>
                    <WitnessInputRow
                      name={needed ? w.name : `${w.name} (not used by ${selected?.name ?? "Call"})`}
                      type={w.type}
                      value={witnessValues[w.name] ?? ""}
                      onChange={(val) => setWitnessValue(w.name, val)}
                    />
                  </div>
                );
              })}
              {witnessErr && <p className="text-2xs text-warning">{witnessErr}</p>}
            </div>
          )}
        </PanelSection>
      )}

      <PanelSection title="Circuits">
        {circuits.length === 0 ? (
          <PanelEmpty title="No exported circuits" detail="Compile so circuit metadata is available." />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {circuits.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setSelectedCircuit(c.name);
                    setLastResult(null);
                  }}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-mono border transition-colors",
                    selected?.name === c.name
                      ? "border-accent/40 bg-accent/15 text-text-primary"
                      : "border-border/70 bg-white/[0.02] text-text-muted hover:text-text-secondary",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {selected && (
              <div className="rounded-lg border border-border/70 bg-white/[0.015] p-2.5 space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-mono text-text-primary">{selected.name}()</p>
                  <span className="text-2xs font-mono text-text-dim">
                    → {isVoidCircuitOutput(selected.output) ? "no return" : selected.output}
                  </span>
                </div>

                {selected.inputs.length === 0 ? (
                  <p className="text-2xs text-text-dim">No arguments</p>
                ) : (
                  selected.inputs.map((input) => (
                    <CompactValueInputRow
                      key={input.name}
                      name={input.name}
                      type={input.type}
                      typeSchema={input.typeSchema}
                      typeEnv={typeEnv}
                      value={circuitInputs[selected.name]?.[input.name] ?? ""}
                      onChange={(val) =>
                        setCircuitInputs((prev) => ({
                          ...prev,
                          [selected.name]: { ...(prev[selected.name] ?? {}), [input.name]: val },
                        }))
                      }
                      disabled={!!callingCircuit}
                    />
                  ))
                )}

                <Button
                  variant={canCallOnChain ? "accent" : "default"}
                  size="sm"
                  className="w-full"
                  onClick={() => void handleCall()}
                  loading={callingCircuit === selected.name}
                  disabled={!!callingCircuit || status !== "idle" || !canCallOnChain}
                  title={canCallOnChain ? undefined : (callBlockedReason ?? undefined)}
                >
                  {callingCircuit === selected.name
                    ? "Proving in 1AM…"
                    : `Send ${selected.name}()`}
                </Button>
                {!canCallOnChain && callBlockedReason && (
                  <p className="text-2xs text-text-dim leading-relaxed">{callBlockedReason}</p>
                )}

                {lastResult && (
                  <CallResultCard
                    result={lastResult}
                    outputType={selected.output}
                    ledger={decodedState}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </PanelSection>

      <JoinAnother
        open={joinOpen}
        onToggle={() => setJoinOpen((v) => !v)}
        addressInput={addressInput}
        setAddressInput={setAddressInput}
        onLoad={handleLoadAddress}
        savedAddress={deployResult?.contractAddress}
      />
    </div>
  );
}

function CallResultCard({
  result,
  outputType,
  ledger,
}: {
  result: CircuitCallResult;
  outputType?: string;
  ledger: Record<string, string> | null;
}) {
  const explorer = result.txHash || result.txId;
  const voidOut = isVoidCircuitOutput(outputType);
  const showReturn =
    result.success &&
    result.returnValue != null &&
    result.returnValue !== "" &&
    !(voidOut && result.returnValue === "[]");

  return (
    <div
      className={cn(
        "rounded-md border p-2.5 space-y-2",
        result.success ? "border-success/25 bg-success/8" : "border-error/20 bg-error/8",
      )}
    >
      <p className={cn("text-xs font-medium", result.success ? "text-success" : "text-error")}>
        {result.success ? result.message : result.message}
      </p>
      {showReturn && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">
            Circuit return{outputType ? ` · ${outputType}` : ""}
          </p>
          <pre className="text-xs font-mono text-text-primary whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
            {result.returnValue}
          </pre>
        </div>
      )}
      {result.success && voidOut && !showReturn && (
        <p className="text-2xs text-text-muted leading-relaxed">
          This circuit has no return value. Public ledger above is the on-chain result.
        </p>
      )}
      {result.success && ledger && Object.keys(ledger).length > 0 && (
        <p className="text-2xs text-text-dim">Ledger snapshot refreshed from the indexer.</p>
      )}
      {explorer && (
        <a
          href={oneAmTxUrl(explorer)}
          target="_blank"
          rel="noreferrer"
          className="text-2xs font-mono text-accent hover:underline break-all"
        >
          View transaction
        </a>
      )}
    </div>
  );
}

function JoinAnother({
  open,
  onToggle,
  addressInput,
  setAddressInput,
  onLoad,
  savedAddress,
}: {
  open: boolean;
  onToggle: () => void;
  addressInput: string;
  setAddressInput: (v: string) => void;
  onLoad: (addr?: string) => void;
  savedAddress?: string;
}) {
  return (
    <PanelSection
      title="Join another contract"
      action={
        <button type="button" className="text-2xs text-text-muted hover:text-text-primary" onClick={onToggle}>
          {open ? "Hide" : "Show"}
        </button>
      }
    >
      {open && (
        <div className="space-y-2">
          <PanelHint label="Same compiled artifacts">
            Load an address deployed from this project (same Compact source / ZK keys).
          </PanelHint>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onLoad();
              }}
              placeholder="Contract address…"
              spellCheck={false}
              className="flex-1 min-w-0 bg-surface-muted border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50"
            />
            <Button size="sm" onClick={() => onLoad()} disabled={!addressInput.trim()}>
              Load
            </Button>
          </div>
          {savedAddress && addressInput.trim() !== savedAddress && (
            <button
              type="button"
              className="text-2xs text-text-secondary hover:underline"
              onClick={() => {
                onLoad(savedAddress);
              }}
            >
              Use saved deploy
            </button>
          )}
        </div>
      )}
    </PanelSection>
  );
}
