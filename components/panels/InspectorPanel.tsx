"use client";

import { useState, useCallback, useEffect } from "react";
import { useIDEStore } from "@/store/ide";
import { Button, Badge, Tabs, StatusDot } from "@/components/ui";
import {
  extractCircuits,
  extractLedgerVars,
  extractWitnesses,
} from "@/lib/compact";
import { cn, generateId } from "@/lib/utils";
import type { PanelTab } from "@/store/ide";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import { getDeployGate, getLiveCompactSource } from "@/lib/deploy-gate";
import { oneAmContractUrl } from "@/lib/explorers";
import {
  bytesLengthFromType,
  generateBytesHex,
  validateWitnessValues,
  witnessFieldKind,
} from "@/lib/playground-witnesses";

export function InspectorPanel() {
  const { rightPanelTab, setRightPanelTab } = useIDEStore();

  const tabs = [
    { id: "contract-ui", label: "Contract UI" },
    { id: "source-scan", label: "Source" },
  ];

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border overflow-hidden">
      <div className="flex-shrink-0 border-b border-border">
        <Tabs
          tabs={tabs}
          activeTab={rightPanelTab}
          onTabChange={(id) => setRightPanelTab(id as PanelTab)}
          size="sm"
          className="px-1"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {rightPanelTab === "contract-ui" && <ContractUITab />}
        {rightPanelTab === "source-scan" && <SourceScanTab />}
      </div>
    </div>
  );
}

// ─── Source Scan (honest regex view — not a ZK analysis) ───────────────────────

function SourceScanTab() {
  const { code } = useIDEStore();
  const ledgerVars = extractLedgerVars(code);
  const witnesses = extractWitnesses(code);
  const circuits = extractCircuits(code);

  return (
    <div className="p-4 space-y-4">
      <div className="p-3 bg-info/6 border border-info/15 rounded-md">
        <p className="text-xs text-text-secondary leading-relaxed">
          Source scan only (regex over your Compact text). Not compiler analysis and not proof verification.
          Ledger fields are public on-chain; witnesses stay off-chain in proofs.
        </p>
      </div>

      <Section title="Public ledger">
        {ledgerVars.length === 0 ? (
          <EmptyState message="No ledger declarations found." />
        ) : (
          <div className="space-y-1.5">
            {ledgerVars.map((v) => (
              <ScanRow key={v.name} name={v.name} type={v.type} badge="public" />
            ))}
          </div>
        )}
      </Section>

      <Section title="Witnesses">
        {witnesses.length === 0 ? (
          <EmptyState message="No witness declarations found." />
        ) : (
          <div className="space-y-1.5">
            {witnesses.map((w) => (
              <ScanRow key={w.name} name={w.name} type={w.type} badge="private" />
            ))}
          </div>
        )}
      </Section>

      <Section title="Exported circuits">
        {circuits.length === 0 ? (
          <EmptyState message="No export circuit declarations found." />
        ) : (
          <div className="space-y-2">
            {circuits.map((c) => (
              <div key={c.name} className="p-3 bg-surface-2 border border-border rounded-md">
                <span className="text-sm font-mono text-text-primary">{c.name}()</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.inputs.length === 0 ? (
                    <span className="text-2xs text-text-muted">No parameters</span>
                  ) : (
                    c.inputs.map((i) => (
                      <span
                        key={i.name}
                        className="text-2xs font-mono bg-white/4 text-text-secondary px-1.5 py-0.5 rounded"
                      >
                        {i.name}: <span className="text-info">{i.type}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function ScanRow({
  name,
  type,
  badge,
}: {
  name: string;
  type: string;
  badge: "public" | "private";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-2.5 rounded-md border",
        badge === "public" ? "border-info/15 bg-info/5" : "border-warning/15 bg-warning/5",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-mono text-text-primary">{name}</span>
          <span className={cn("text-xs font-mono", badge === "public" ? "text-info" : "text-warning")}>
            {type}
          </span>
        </div>
      </div>
      <Badge variant={badge === "public" ? "info" : "warning"} dot>
        {badge}
      </Badge>
    </div>
  );
}

// ─── Contract UI Tab ───────────────────────────────────────────────────────────

interface ContractInfo {
  address: string;
  state: string | null;
  txHash: string | null;
  blockHeight: number | null;
}
interface CircuitCallResult {
  success: boolean;
  message: string;
  txId?: string;
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

function ContractUITab() {
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
  } = useIDEStore();
  const lace = useLaceWallet();

  const witnesses = extractWitnesses(code);
  const witnessErr = validateWitnessValues(witnesses, witnessValues);

  const [addressInput, setAddressInput] = useState(deployResult?.contractAddress ?? "");
  const [activeAddress, setActiveAddress] = useState(deployResult?.contractAddress ?? "");

  useEffect(() => {
    if (deployResult?.contractAddress) {
      setAddressInput(deployResult.contractAddress);
      setActiveAddress(deployResult.contractAddress);
    }
  }, [deployResult?.contractAddress]);

  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [decodedState, setDecodedState] = useState<Record<string, string> | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  const fetchState = useCallback(
    async (addr: string) => {
      if (!addr.trim()) return;
      setStateLoading(true);
      setStateError(null);
      try {
        const res = await fetch("/api/indexer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `{ contractAction(address: "${addr}") { address state transaction { hash block { height } } } }`,
          }),
        });
        const json = (await res.json()) as IndexerResponse;
        const action = json.data?.contractAction;
        if (!action) {
          setContractInfo(null);
          setDecodedState(null);
          setStateError("Contract not found on Midnight Preprod");
          return;
        }
        setContractInfo({
          address: action.address,
          state: action.state ?? null,
          txHash: action.transaction?.hash ?? null,
          blockHeight: action.transaction?.block?.height ?? null,
        });
        if (activeProject?.template) {
          const { readPlaygroundState } = await import("@/lib/playground-call");
          readPlaygroundState(activeProject.template, addr, {
            artifactBaseUrl: activeProject.artifactBaseUrl,
          })
            .then(setDecodedState)
            .catch(() => setDecodedState(null));
        }
      } catch (err) {
        setStateError(err instanceof Error ? err.message : "Indexer unreachable");
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
  const [circuitResults, setCircuitResults] = useState<Record<string, CircuitCallResult>>({});
  const [callingCircuit, setCallingCircuit] = useState<string | null>(null);

  const circuits =
    (compileResult?.circuitMetadata?.length ?? 0) > 0
      ? compileResult!.circuitMetadata!
      : extractCircuits(code);
  const ledgerVars = extractLedgerVars(code);

  const template = activeProject?.template ?? "";
  const liveSource = getLiveCompactSource({
    files: activeProject?.files ?? [],
    activeFileId,
    code,
    tabBuffers,
  });
  const deployGate = getDeployGate({
    template,
    artifactBaseUrl: activeProject?.artifactBaseUrl,
    compiledSourceHash: activeProject?.compiledSourceHash,
    currentSource: liveSource,
  });
  const canCallOnChain =
    !!lace.connectedAPI &&
    !!activeAddress &&
    deployGate.canDeploy &&
    !witnessErr;

  const justDeployed = !!deployResult?.success && !!deployResult.contractAddress;
  const suggestedCircuit =
    circuits.find((c) => c.name === "storeMessage") ??
    circuits.find((c) => c.name === "increment") ??
    circuits.find((c) => c.name === "post") ??
    circuits[0];
  const callBlockedReason = !activeAddress
    ? "Deploy a contract first (toolbar → Deploy)."
    : !lace.connectedAPI
      ? "Connect 1AM to send transactions."
      : !deployGate.canDeploy
        ? deployGate.reason
        : witnessErr
          ? witnessErr
          : null;

  const handleLoadAddress = () => {
    const addr = addressInput.trim();
    if (!addr) return;
    if (addr === activeAddress) {
      void fetchState(addr);
    } else {
      setActiveAddress(addr);
      setContractInfo(null);
      setStateError(null);
    }
  };

  const handleCall = useCallback(
    async (circuit: { name: string; inputs: Array<{ name: string; type: string }> }) => {
      if (callingCircuit) return;

      if (!canCallOnChain) {
        addLog({
          id: generateId(),
          timestamp: Date.now(),
          level: "error",
          message:
            callBlockedReason ??
            "On-chain call requires deployable artifacts, a contract address, a connected Midnight wallet, and any private witnesses filled in.",
          source: "network",
        });
        setCircuitResults((prev) => ({
          ...prev,
          [circuit.name]: {
            success: false,
            message: callBlockedReason ?? "On-chain call unavailable.",
          },
        }));
        return;
      }

      const inputs = circuitInputs[circuit.name] ?? {};
      setCallingCircuit(circuit.name);
      clearLogs();
      setLogTab("network");
      setBottomPanelOpen(true);

      try {
        const { callPlaygroundCircuit } = await import("@/lib/playground-call");
        const result = await callPlaygroundCircuit(
          lace.connectedAPI!,
          activeProject!.template,
          activeAddress,
          circuit.name,
          inputs,
          addLog,
          {
            artifactBaseUrl: activeProject?.artifactBaseUrl,
            projectId: activeProject?.id,
            witnessSpecs: witnesses,
            witnessValues,
          },
        );
        setCircuitResults((prev) => ({
          ...prev,
          [circuit.name]: { success: true, message: "Transaction submitted", txId: result.txId },
        }));
        void fetchState(activeAddress);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setCircuitResults((prev) => ({
          ...prev,
          [circuit.name]: { success: false, message: msg },
        }));
        addLog({
          id: generateId(),
          timestamp: Date.now(),
          level: "error",
          message: `Circuit call failed: ${msg}`,
          source: "network",
        });
      }

      setCallingCircuit(null);
    },
    [
      callingCircuit,
      circuitInputs,
      canCallOnChain,
      callBlockedReason,
      lace.connectedAPI,
      activeProject,
      activeAddress,
      witnesses,
      witnessValues,
      addLog,
      clearLogs,
      setLogTab,
      setBottomPanelOpen,
      fetchState,
    ],
  );

  return (
    <div className="p-4 space-y-5">
      {justDeployed && (
        <div className="p-3 rounded-lg border border-success/25 bg-success/8 space-y-2">
          <p className="text-sm font-medium text-success">Contract deployed</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            {lace.connectedAPI
              ? suggestedCircuit
                ? `Next: scroll to Interact and click Call ${suggestedCircuit.name}(). Proofs take 1-2 minutes; approve the fee in your wallet when prompted.`
                : "Next: call a circuit below. Proofs take 1-2 minutes."
              : "Connect a Midnight wallet (toolbar or button below), then call a circuit."}
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {deployResult?.contractAddress && (
              <a
                href={oneAmContractUrl(deployResult.contractAddress)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-accent hover:opacity-90 transition-opacity"
              >
                View on explorer
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3 h-3">
                  <path d="M5 2H2.5A1.5 1.5 0 001 3.5v6A1.5 1.5 0 002.5 11h6A1.5 1.5 0 0010 9.5V7M7 1h4v4M11 1L5.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
            {!lace.connectedAPI && (
              <Button size="sm" variant="accent" onClick={() => void lace.connect()}>
                Connect 1AM
              </Button>
            )}
          </div>
        </div>
      )}

      <div>
        <SectionLabel text="Active Contract" />
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLoadAddress();
              }}
              placeholder="Contract address (filled after Deploy)…"
              spellCheck={false}
              className="flex-1 min-w-0 bg-surface border border-border rounded px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/60 transition-colors"
            />
            <Button size="sm" onClick={handleLoadAddress} disabled={!addressInput.trim()}>
              {activeAddress && addressInput.trim() === activeAddress ? "↻" : "Load"}
            </Button>
          </div>

          {activeAddress ? (
            <div className="flex items-center gap-2 flex-wrap">
              <StatusDot status={contractInfo ? "success" : stateError ? "error" : "idle"} />
              <a
                href={oneAmContractUrl(activeAddress)}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-accent hover:underline select-all"
                title="View contract on 1AM Explorer"
              >
                {activeAddress.slice(0, 14)}…{activeAddress.slice(-8)}
              </a>
              <Badge variant="info" size="sm">
                preprod
              </Badge>
              <a
                href={oneAmContractUrl(activeAddress)}
                target="_blank"
                rel="noreferrer"
                className="text-2xs text-accent hover:underline font-medium"
              >
                View contract ↗
              </a>
            </div>
          ) : (
            <p className="text-2xs text-text-dim leading-relaxed">
              Click <span className="text-text-secondary">Deploy</span> in the toolbar for Hello Midnight
              or Counter. The address appears here automatically.
            </p>
          )}
        </div>
      </div>

      {witnesses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel text="Private witnesses" />
            <Badge variant={witnessErr ? "warning" : "success"} size="sm" dot>
              {witnessErr ? "needed for Call" : "ready"}
            </Badge>
          </div>
          <p className="mb-2 text-2xs text-text-muted leading-relaxed">
            Auto-detected from this project&apos;s Compact source. Needed when you Call circuits that
            read them (e.g. post / takeDown) — not required to Deploy. Keep the same values across
            related calls.
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
          {witnessErr && (
            <p className="mt-2 text-2xs text-warning leading-relaxed">{witnessErr}</p>
          )}
        </div>
      )}

      {activeAddress && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel text="On-Chain State" />
            <button
              onClick={() => void fetchState(activeAddress)}
              disabled={stateLoading}
              className="text-text-dim hover:text-text-muted disabled:opacity-40 transition-colors"
              title="Refresh"
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

          {stateLoading && (
            <div className="flex items-center gap-2 py-2 text-xs text-text-muted">
              <div className="w-3 h-3 rounded-full border border-accent border-t-transparent animate-spin flex-shrink-0" />
              Querying indexer…
            </div>
          )}

          {stateError && !stateLoading && (
            <div className="p-2 bg-error/5 border border-error/15 rounded text-xs text-error">{stateError}</div>
          )}

          {contractInfo && !stateLoading && (
            <div className="space-y-2">
              {ledgerVars.length > 0 && (
                <div className="space-y-1">
                  {ledgerVars.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-surface-2 border border-border rounded-md"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-text-primary">{v.name}</span>
                        <span className="text-2xs font-mono text-info opacity-70">{v.type}</span>
                      </div>
                      {decodedState?.[v.name] !== undefined ? (
                        <span
                          className="text-xs font-mono text-success truncate max-w-[160px]"
                          title={decodedState[v.name]}
                        >
                          {decodedState[v.name]}
                        </span>
                      ) : (
                        <Badge variant="info" size="sm" dot>
                          public
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {contractInfo.txHash && (
                <div className="flex items-start justify-between pt-2 border-t border-border gap-2">
                  <div className="min-w-0">
                    <p className="text-2xs text-text-dim uppercase tracking-wide mb-0.5">Last transaction</p>
                    <p className="text-xs font-mono text-text-secondary truncate">
                      {contractInfo.txHash.slice(0, 20)}…{contractInfo.txHash.slice(-8)}
                    </p>
                  </div>
                  {contractInfo.blockHeight && (
                    <Badge variant="muted" size="sm">
                      block #{contractInfo.blockHeight.toLocaleString()}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel text="Interact" />
          <Badge variant={canCallOnChain ? "success" : "muted"} size="sm" dot>
            {canCallOnChain ? "ready" : "unavailable"}
          </Badge>
        </div>

        {!canCallOnChain && (
          <div className="mb-3 p-2.5 bg-white/3 border border-border rounded-md text-2xs text-text-muted leading-relaxed space-y-2">
            <p>{callBlockedReason}</p>
            {activeAddress && !lace.connectedAPI && (
              <Button size="sm" variant="accent" onClick={() => void lace.connect()}>
                Connect 1AM
              </Button>
            )}
          </div>
        )}

        {canCallOnChain && suggestedCircuit && (
          <p className="mb-3 text-2xs text-text-muted leading-relaxed">
            Try <span className="text-text-secondary font-mono">Call {suggestedCircuit.name}()</span>
            {suggestedCircuit.name === "storeMessage" ? ' with a message like "hi"' : ""}, then refresh
            On-Chain State above.
          </p>
        )}

        {circuits.length === 0 ? (
          <EmptyState message="No circuits found. Open Hello Midnight or run Check syntax / Compile." />
        ) : (
          <div className="space-y-3">
            {circuits.map((circuit) => (
              <CircuitCallCard
                key={circuit.name}
                circuit={circuit}
                inputs={circuitInputs[circuit.name] ?? {}}
                onInputChange={(name, val) =>
                  setCircuitInputs((prev) => ({
                    ...prev,
                    [circuit.name]: { ...(prev[circuit.name] ?? {}), [name]: val },
                  }))
                }
                onCall={() => void handleCall(circuit)}
                result={circuitResults[circuit.name]}
                isLoading={callingCircuit === circuit.name}
                canCallOnChain={canCallOnChain}
                disabledReason={callBlockedReason}
                disabled={status !== "idle" || (!!callingCircuit && callingCircuit !== circuit.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WitnessInputRow({
  name,
  type,
  value,
  onChange,
}: {
  name: string;
  type: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const kind = witnessFieldKind(type);
  const byteLen = bytesLengthFromType(type) ?? 32;

  return (
    <div className="p-2.5 bg-warning/5 border border-warning/15 rounded-md space-y-1.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xs font-mono text-text-primary">{name}</span>
        <span className="text-2xs font-mono text-warning">{type}</span>
        <Badge variant="warning" size="sm" className="ml-auto">
          private
        </Badge>
      </div>
      {kind === "boolean" ? (
        <select
          value={value === "false" ? "false" : value === "true" ? "true" : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent/60"
        >
          <option value="">Select…</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder={
              kind === "bytes"
                ? `${byteLen * 2} hex chars`
                : kind === "integer"
                  ? "integer"
                  : "value"
            }
            className="flex-1 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/60"
          />
          {kind === "bytes" && (
            <Button
              size="sm"
              variant="ghost"
              title={`Generate random ${type}`}
              onClick={() => onChange(generateBytesHex(byteLen))}
            >
              Generate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function CircuitCallCard({
  circuit,
  inputs,
  onInputChange,
  onCall,
  result,
  isLoading,
  canCallOnChain,
  disabledReason,
  disabled,
}: {
  circuit: { name: string; inputs: Array<{ name: string; type: string }>; output?: string };
  inputs: Record<string, string>;
  onInputChange: (name: string, val: string) => void;
  onCall: () => void;
  result: CircuitCallResult | undefined;
  isLoading: boolean;
  canCallOnChain: boolean;
  disabledReason: string | null;
  disabled: boolean;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/3 border-b border-border">
        <span className="text-sm font-mono text-text-primary">{circuit.name}</span>
        {circuit.output && circuit.output !== "[]" && (
          <Badge variant="muted" size="sm" className="ml-auto">
            → {circuit.output}
          </Badge>
        )}
      </div>

      <div className="p-3 space-y-2">
        {circuit.inputs.length > 0 ? (
          circuit.inputs.map((input) => (
            <div key={input.name}>
              <label className="text-2xs text-text-muted font-mono mb-1 block">
                {input.name}
                <span className="ml-1.5 text-info opacity-70">{input.type}</span>
              </label>
              <input
                type="text"
                value={inputs[input.name] ?? ""}
                onChange={(e) => onInputChange(input.name, e.target.value)}
                placeholder={circuit.name === "storeMessage" ? "hi" : `${input.type}…`}
                disabled={isLoading || disabled}
                className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 transition-colors disabled:opacity-50"
              />
            </div>
          ))
        ) : (
          <p className="text-xs text-text-muted">No inputs required</p>
        )}

        <Button
          variant={canCallOnChain ? "accent" : "default"}
          size="sm"
          className="w-full mt-1"
          onClick={onCall}
          loading={isLoading}
          disabled={isLoading || disabled || !canCallOnChain}
          title={canCallOnChain ? undefined : (disabledReason ?? undefined)}
        >
          {isLoading ? "Proving & submitting…" : `Call ${circuit.name}()`}
        </Button>
        {!canCallOnChain && disabledReason && (
          <p className="text-2xs text-text-dim">{disabledReason}</p>
        )}

        {result && (
          <div
            className={cn(
              "mt-1 p-2 rounded text-xs font-mono border break-all",
              result.success
                ? "bg-success/5 border-success/20 text-success"
                : "bg-error/5 border-error/20 text-error",
            )}
          >
            <span>{result.success ? "✓ " : "✗ "}</span>
            <span>{result.message}</span>
            {result.txId && (
              <div className="mt-1 text-2xs text-text-muted">tx: {result.txId.slice(0, 40)}…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-2">{text}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-6">
      <p className="text-xs text-text-muted">{message}</p>
    </div>
  );
}
