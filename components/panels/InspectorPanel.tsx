"use client";

import { useState } from "react";
import { useIDEStore } from "@/store/ide";
import { Button, Badge, Tabs, StatusDot } from "@/components/ui";
import {
  extractCircuits,
  extractLedgerVars,
  extractWitnesses,
  mockSimulate,
} from "@/lib/compact";
import { cn } from "@/lib/utils";
import type { PanelTab } from "@/store/ide";

export function InspectorPanel() {
  const { rightPanelTab, setRightPanelTab } = useIDEStore();

  const tabs = [
    { id: "simulation", label: "Simulation" },
    { id: "privacy", label: "Privacy" },
    { id: "contract-ui", label: "Contract UI" },
  ];

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border overflow-hidden">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-border">
        <Tabs
          tabs={tabs}
          activeTab={rightPanelTab}
          onTabChange={(id) => setRightPanelTab(id as PanelTab)}
          size="sm"
          className="px-1"
        />
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {rightPanelTab === "simulation" && <SimulationTab />}
        {rightPanelTab === "privacy" && <PrivacyTab />}
        {rightPanelTab === "contract-ui" && <ContractUITab />}
      </div>
    </div>
  );
}

// ─── Simulation Tab ────────────────────────────────────────────────────────────

function SimulationTab() {
  const {
    code,
    status,
    setStatus,
    simulateResult,
    setSimulateResult,
    simulateInputs,
    setSimulateInputs,
    activeCircuit,
    setActiveCircuit,
    addLog,
    setLogTab,
    setBottomPanelOpen,
  } = useIDEStore();

  const circuits = extractCircuits(code);

  const selectedCircuit = circuits.find((c) => c.name === activeCircuit) || circuits[0];

  const handleSimulate = async () => {
    if (!selectedCircuit || status !== "idle") return;
    setLogTab("logs");
    setBottomPanelOpen(true);
    setStatus("simulating");
    setSimulateResult(null);
    const result = await mockSimulate(selectedCircuit.name, simulateInputs, addLog);
    setSimulateResult(result);
    setStatus("idle");
  };

  return (
    <div className="p-4 space-y-4">
      {/* Circuit selector */}
      <Section title="Select Circuit">
        {circuits.length === 0 ? (
          <EmptyState message="No circuits found. Run the compiler first." />
        ) : (
          <div className="space-y-1">
            {circuits.map((c) => (
              <button
                key={c.name}
                onClick={() => setActiveCircuit(c.name)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md border text-sm transition-all",
                  (activeCircuit === c.name || (!activeCircuit && c === circuits[0]))
                    ? "border-accent/30 bg-accent/8 text-text-primary"
                    : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">{c.name}()</span>
                  <span className="text-2xs text-text-muted">{c.constraints} constraints</span>
                </div>
                {c.inputs.length > 0 && (
                  <div className="mt-0.5 text-2xs text-text-muted font-mono">
                    {c.inputs.map((i) => `${i.name}: ${i.type}`).join(", ")}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Inputs */}
      {selectedCircuit && (
        <Section title="Inputs">
          {selectedCircuit.inputs.length === 0 ? (
            <p className="text-xs text-text-muted">This circuit takes no inputs.</p>
          ) : (
            <div className="space-y-2">
              {selectedCircuit.inputs.map((input) => (
                <div key={input.name}>
                  <label className="text-xs text-text-muted font-mono mb-1 block">
                    {input.name}
                    <span className="ml-1.5 text-info">{input.type}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={`Enter ${input.type}...`}
                    value={simulateInputs[input.name] ?? ""}
                    onChange={(e) =>
                      setSimulateInputs({ ...simulateInputs, [input.name]: e.target.value })
                    }
                    className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 transition-colors"
                  />
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Actions */}
      <Button
        variant="accent"
        size="lg"
        className="w-full"
        onClick={handleSimulate}
        loading={status === "simulating"}
        disabled={status !== "idle" || !selectedCircuit}
      >
        {status === "simulating" ? "Simulating…" : "Run Simulation"}
      </Button>

      {/* Result */}
      {simulateResult && (
        <Section title="Result">
          <div className={cn(
            "p-3 rounded-md border text-sm",
            simulateResult.success
              ? "border-success/20 bg-success/6"
              : "border-error/20 bg-error/6"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <StatusDot status={simulateResult.success ? "success" : "error"} />
              <span className={cn("font-medium", simulateResult.success ? "text-success" : "text-error")}>
                {simulateResult.success ? "Execution successful" : "Execution failed"}
              </span>
              <span className="ml-auto text-xs text-text-muted">{simulateResult.duration}ms</span>
            </div>

            {simulateResult.output !== undefined && (
              <div className="font-mono text-xs text-text-primary bg-surface-2 rounded px-2 py-1.5 mt-2">
                output: <span className="text-warning">{JSON.stringify(simulateResult.output)}</span>
              </div>
            )}

            {simulateResult.stateChanges && simulateResult.stateChanges.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-2xs text-text-muted uppercase tracking-wide">State Changes</p>
                {simulateResult.stateChanges.map((sc) => (
                  <div key={sc.key} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-text-secondary">{sc.key}:</span>
                    <span className="text-error line-through text-text-dim">{sc.before}</span>
                    <span className="text-text-dim">→</span>
                    <span className="text-success">{sc.after}</span>
                  </div>
                ))}
              </div>
            )}

            {simulateResult.gasUsed !== undefined && (
              <div className="mt-2 text-2xs text-text-muted">
                Gas used: <span className="text-text-secondary font-mono">{simulateResult.gasUsed.toLocaleString()}</span>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Privacy Tab ───────────────────────────────────────────────────────────────

function PrivacyTab() {
  const { code } = useIDEStore();
  const ledgerVars = extractLedgerVars(code);
  const witnesses = extractWitnesses(code);
  const circuits = extractCircuits(code);

  return (
    <div className="p-4 space-y-4">
      {/* Header explanation */}
      <div className="p-3 bg-info/6 border border-info/15 rounded-md">
        <p className="text-xs text-text-secondary leading-relaxed">
          Midnight uses <span className="text-info font-medium">zero-knowledge proofs</span> to separate
          public and private state. Ledger variables are public; witnesses are private.
        </p>
      </div>

      {/* Public state */}
      <Section title="Public State" icon="🔓">
        {ledgerVars.length === 0 ? (
          <EmptyState message="No public ledger variables found." />
        ) : (
          <div className="space-y-1.5">
            {ledgerVars.map((v) => (
              <PrivacyVar
                key={v.name}
                name={v.name}
                type={v.type}
                isPublic
                description="Stored on-chain, visible to everyone"
              />
            ))}
          </div>
        )}
      </Section>

      {/* Private state */}
      <Section title="Private Witnesses" icon="🔒">
        {witnesses.length === 0 ? (
          <EmptyState message="No private witnesses found." />
        ) : (
          <div className="space-y-1.5">
            {witnesses.map((w) => (
              <PrivacyVar
                key={w.name}
                name={w.name}
                type={w.type}
                isPublic={false}
                description="Never revealed — used only in ZK proofs"
              />
            ))}
          </div>
        )}
      </Section>

      {/* Circuit privacy analysis */}
      {circuits.length > 0 && (
        <Section title="Circuit Analysis">
          <div className="space-y-2">
            {circuits.map((c) => (
              <div key={c.name} className="p-3 bg-surface-2 border border-border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono text-text-primary">{c.name}()</span>
                  <Badge variant="muted">{c.constraints} constraints</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.inputs.map((i) => (
                    <span key={i.name} className="text-2xs font-mono bg-white/4 text-text-secondary px-1.5 py-0.5 rounded">
                      {i.name}: <span className="text-info">{i.type}</span>
                    </span>
                  ))}
                  {c.inputs.length === 0 && (
                    <span className="text-2xs text-text-muted">No public inputs</span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-2xs text-text-muted">ZK proof generated for each execution</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Legend */}
      <div className="border-t border-border pt-3 space-y-1.5">
        <p className="text-2xs text-text-dim uppercase tracking-wide">Legend</p>
        <div className="flex items-center gap-2">
          <span className="text-sm">🔓</span>
          <span className="text-xs text-text-secondary">On-chain (public) — Anyone can read</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">🔒</span>
          <span className="text-xs text-text-secondary">Off-chain (private) — Only prover knows</span>
        </div>
      </div>
    </div>
  );
}

function PrivacyVar({
  name,
  type,
  isPublic,
  description,
}: {
  name: string;
  type: string;
  isPublic: boolean;
  description: string;
}) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-2.5 rounded-md border transition-colors",
      isPublic
        ? "border-info/15 bg-info/5"
        : "border-warning/15 bg-warning/5"
    )}>
      <span className="text-lg leading-none mt-0.5">{isPublic ? "🔓" : "🔒"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-mono text-text-primary">{name}</span>
          <span className={cn("text-xs font-mono", isPublic ? "text-info" : "text-warning")}>{type}</span>
        </div>
        <p className="text-2xs text-text-muted mt-0.5">{description}</p>
      </div>
      <Badge variant={isPublic ? "info" : "warning"} dot>
        {isPublic ? "public" : "private"}
      </Badge>
    </div>
  );
}

// ─── Contract UI Tab ───────────────────────────────────────────────────────────

function ContractUITab() {
  const { code, status, deployResult, simulateInputs, setSimulateInputs, setStatus, setSimulateResult, addLog, setLogTab, setBottomPanelOpen, setActiveCircuit } = useIDEStore();
  const circuits = extractCircuits(code);
  const [results, setResults] = useState<Record<string, unknown>>({});

  const handleCall = async (circuitName: string) => {
    if (status !== "idle") return;
    setLogTab("logs");
    setBottomPanelOpen(true);
    setActiveCircuit(circuitName);
    setStatus("simulating");
    const result = await mockSimulate(circuitName, simulateInputs, addLog);
    setSimulateResult(result);
    setResults((prev) => ({ ...prev, [circuitName]: result.output }));
    setStatus("idle");
  };

  return (
    <div className="p-4 space-y-4">
      {/* Deploy status */}
      {deployResult ? (
        <div className="p-3 bg-success/6 border border-success/20 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status="success" />
            <span className="text-sm font-medium text-success">Contract Deployed</span>
          </div>
          <div className="text-2xs font-mono text-text-secondary mt-1 break-all">
            {deployResult.contractAddress}
          </div>
          {deployResult.blockNumber && (
            <div className="text-2xs text-text-muted mt-1">Block #{deployResult.blockNumber}</div>
          )}
        </div>
      ) : (
        <div className="p-3 bg-white/3 border border-border rounded-md text-xs text-text-muted text-center">
          Deploy the contract to interact with it on-chain
        </div>
      )}

      {/* Auto-generated circuit UI */}
      {circuits.length === 0 ? (
        <EmptyState message="No exported circuits found. Add 'export circuit' to your contract." />
      ) : (
        <div className="space-y-3">
          {circuits.map((circuit) => (
            <CircuitCallCard
              key={circuit.name}
              circuit={circuit}
              inputs={simulateInputs}
              onInputChange={(name, val) =>
                setSimulateInputs({ ...simulateInputs, [name]: val })
              }
              onCall={() => handleCall(circuit.name)}
              result={results[circuit.name]}
              isLoading={status === "simulating"}
            />
          ))}
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
}: {
  circuit: ReturnType<typeof extractCircuits>[0];
  inputs: Record<string, string>;
  onInputChange: (name: string, val: string) => void;
  onCall: () => void;
  result: unknown;
  isLoading: boolean;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Circuit header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/3 border-b border-border">
        <svg className="w-3.5 h-3.5 text-accent flex-shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="6" cy="6" r="4" />
          <path d="M6 4v2l1.5 1.5" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-mono text-text-primary">{circuit.name}</span>
        <Badge variant="muted" className="ml-auto">{circuit.output}</Badge>
      </div>

      {/* Inputs */}
      <div className="p-3 space-y-2">
        {circuit.inputs.length > 0 ? (
          circuit.inputs.map((input) => (
            <div key={input.name}>
              <label className="text-2xs text-text-muted font-mono mb-1 block">
                {input.name}
                <span className="ml-1 text-info opacity-70">{input.type}</span>
              </label>
              <input
                type="text"
                value={inputs[input.name] ?? ""}
                onChange={(e) => onInputChange(input.name, e.target.value)}
                placeholder={`${input.type}...`}
                className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 transition-colors"
              />
            </div>
          ))
        ) : (
          <p className="text-xs text-text-muted">No inputs required</p>
        )}

        <Button
          variant="default"
          size="sm"
          className="w-full mt-1"
          onClick={onCall}
          loading={isLoading}
          disabled={isLoading}
        >
          Call {circuit.name}()
        </Button>

        {/* Output */}
        {result !== undefined && (
          <div className="mt-1 p-2 bg-surface-2 border border-success/20 rounded text-xs font-mono">
            <span className="text-text-muted">returns: </span>
            <span className="text-success">{JSON.stringify(result)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared components ─────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span className="text-base">{icon}</span>}
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
