"use client";

import { useRef, useEffect } from "react";
import { useIDEStore } from "@/store/ide";
import { Tabs, Badge, Button, IconButton, StatusDot } from "@/components/ui";
import { cn, formatTimestamp } from "@/lib/utils";
import type { LogEntry } from "@/lib/compact";
import type { LogTab } from "@/store/ide";

export function BottomPanel() {
  const { logTab, setLogTab, bottomPanelOpen, setBottomPanelOpen, logs, clearLogs } = useIDEStore();

  const tabs = [
    { id: "logs", label: "Logs", badge: logs.length > 0 ? logs.length : undefined },
    { id: "compile", label: "Compile" },
    { id: "network", label: "Network" },
  ];

  return (
    <div className="flex flex-col h-full bg-surface border-t border-border overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center border-b border-border flex-shrink-0">
        <Tabs
          tabs={tabs}
          activeTab={logTab}
          onTabChange={(id) => setLogTab(id as LogTab)}
          size="sm"
          className="px-1"
        />

        <div className="flex items-center gap-1 ml-auto pr-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={clearLogs}
            className="text-text-muted"
          >
            Clear
          </Button>
          <IconButton
            size="sm"
            title={bottomPanelOpen ? "Collapse panel" : "Expand panel"}
            onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
          >
            <svg className={cn("w-3.5 h-3.5 transition-transform", !bottomPanelOpen && "rotate-180")} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Panel content */}
      {bottomPanelOpen && (
        <div className="flex-1 overflow-hidden">
          {logTab === "logs" && <LogsPanel />}
          {logTab === "compile" && <CompilePanel />}
          {logTab === "network" && <NetworkPanel />}
        </div>
      )}
    </div>
  );
}

// ─── Logs Panel ─────────────────────────────────────────────────────────────

function LogsPanel() {
  const { logs, status } = useIDEStore();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="h-full overflow-y-auto p-3 font-mono text-xs space-y-0.5">
      {logs.length === 0 ? (
        <EmptyTerminal />
      ) : (
        <>
          {logs.map((log, i) => (
            <LogLine key={log.id} log={log} index={i} />
          ))}
          {status !== "idle" && (
            <div className="flex items-center gap-2 text-text-muted terminal-line">
              <span className="text-accent status-pulse">▊</span>
            </div>
          )}
          <div ref={endRef} />
        </>
      )}
    </div>
  );
}

function LogLine({ log, index }: { log: LogEntry; index: number }) {
  const colors = {
    info: "text-text-secondary",
    success: "text-success",
    error: "text-error",
    warn: "text-warning",
    debug: "text-text-muted",
  };

  const prefixes = {
    info: "  ",
    success: "✓ ",
    error: "✗ ",
    warn: "⚠ ",
    debug: "· ",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 leading-relaxed terminal-line",
        colors[log.level]
      )}
      style={{ animationDelay: `${index * 15}ms` }}
    >
      <span className="text-text-dim flex-shrink-0 w-20 text-right">
        {formatTimestamp(log.timestamp)}
      </span>
      {log.source && (
        <span className="flex-shrink-0 text-text-dim opacity-60">
          [{log.source}]
        </span>
      )}
      <span>
        <span className="opacity-60">{prefixes[log.level]}</span>
        {log.message}
      </span>
    </div>
  );
}

// ─── Compile Panel ────────────────────────────────────────────────────────────

function CompilePanel() {
  const { compileResult, status } = useIDEStore();

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {status === "compiling" && (
        <div className="flex items-center gap-3 p-4 bg-accent/5 border border-accent/15 rounded-md">
          <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-text-primary">Compiling…</p>
            <p className="text-xs text-text-muted mt-0.5">Generating constraint system and ZK circuits</p>
          </div>
        </div>
      )}

      {!compileResult && status !== "compiling" && <EmptyTerminal message="Run the compiler to see output." />}

      {compileResult && (
        <div className="space-y-4">
          {/* Status */}
          <div className={cn(
            "flex items-center gap-3 p-4 rounded-md border",
            compileResult.success
              ? "bg-success/6 border-success/20"
              : "bg-error/6 border-error/20"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
              compileResult.success ? "bg-success/15" : "bg-error/15"
            )}>
              <span className="text-lg">{compileResult.success ? "✓" : "✗"}</span>
            </div>
            <div>
              <p className={cn("text-sm font-medium", compileResult.success ? "text-success" : "text-error")}>
                {compileResult.success ? "Compilation successful" : "Compilation failed"}
              </p>
              <p className="text-xs text-text-muted mt-0.5">{compileResult.duration}ms</p>
            </div>
          </div>

          {/* Stats */}
          {compileResult.success && (
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Constraints"
                value={compileResult.constraintCount?.toLocaleString() ?? "—"}
                color="accent"
              />
              <StatCard
                label="Circuits"
                value={String(compileResult.circuitMetadata?.length ?? 0)}
                color="info"
              />
              <StatCard
                label="Warnings"
                value={String(compileResult.warnings?.length ?? 0)}
                color={compileResult.warnings?.length ? "warning" : "muted"}
              />
            </div>
          )}

          {/* Circuit metadata */}
          {compileResult.circuitMetadata && compileResult.circuitMetadata.length > 0 && (
            <div>
              <p className="text-2xs text-text-muted uppercase tracking-wide font-semibold mb-2">Circuits</p>
              <div className="space-y-1.5">
                {compileResult.circuitMetadata.map((c) => (
                  <div key={c.name} className="flex items-center justify-between px-3 py-2 bg-surface-2 border border-border rounded-md text-xs font-mono">
                    <div className="flex items-center gap-2">
                      {c.isExported && (
                        <Badge variant="success" size="sm">export</Badge>
                      )}
                      <span className="text-text-primary">{c.name}()</span>
                    </div>
                    <div className="flex items-center gap-3 text-text-muted">
                      <span>{c.inputs.length} inputs</span>
                      <span>{c.constraints} constraints</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {compileResult.errors && compileResult.errors.length > 0 && (
            <div>
              <p className="text-2xs text-error uppercase tracking-wide font-semibold mb-2">Errors</p>
              <div className="space-y-1">
                {compileResult.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-error/5 border border-error/15 rounded text-xs">
                    <span className="text-error flex-shrink-0">Line {err.line}:{err.column}</span>
                    <span className="text-text-secondary">{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {compileResult.warnings && compileResult.warnings.length > 0 && (
            <div>
              <p className="text-2xs text-warning uppercase tracking-wide font-semibold mb-2">Warnings</p>
              {compileResult.warnings.map((w, i) => (
                <div key={i} className="text-xs text-text-secondary p-2 bg-warning/5 border border-warning/15 rounded">
                  ⚠ {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Network Panel ────────────────────────────────────────────────────────────

function NetworkPanel() {
  const { wallet, deployResult, status } = useIDEStore();

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Wallet status */}
      <div>
        <p className="text-2xs text-text-muted uppercase tracking-wide font-semibold mb-2">Wallet</p>
        <div className="p-3 bg-surface-2 border border-border rounded-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Status</span>
            <StatusDot
              status={wallet.connected ? "success" : "idle"}
              label={wallet.connected ? "Connected" : "Disconnected"}
            />
          </div>
          {wallet.connected && wallet.address && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Address</span>
                <span className="text-xs font-mono text-text-secondary">
                  {wallet.address.slice(0, 10)}…{wallet.address.slice(-6)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Balance</span>
                <span className="text-xs font-mono text-text-primary">{wallet.balance}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Network</span>
                <span className="text-xs font-mono text-info">{wallet.network}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Deploy status */}
      {status === "deploying" && (
        <div className="flex items-center gap-3 p-4 bg-accent/5 border border-accent/15 rounded-md">
          <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-text-primary">Deploying to Midnight Devnet…</p>
            <p className="text-xs text-text-muted mt-0.5">Submitting contract and waiting for confirmation</p>
          </div>
        </div>
      )}

      {deployResult && (
        <div>
          <p className="text-2xs text-text-muted uppercase tracking-wide font-semibold mb-2">Deployment</p>
          <div className={cn(
            "p-3 rounded-md border space-y-2",
            deployResult.success ? "bg-success/6 border-success/20" : "bg-error/6 border-error/20"
          )}>
            <div className="flex items-center gap-2">
              <StatusDot status={deployResult.success ? "success" : "error"} />
              <span className={cn("text-sm font-medium", deployResult.success ? "text-success" : "text-error")}>
                {deployResult.success ? "Deployed successfully" : "Deployment failed"}
              </span>
              <span className="ml-auto text-xs text-text-muted">{deployResult.duration}ms</span>
            </div>

            {deployResult.contractAddress && (
              <div>
                <p className="text-2xs text-text-muted mb-1">Contract Address</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-success break-all flex-1">
                    {deployResult.contractAddress}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(deployResult.contractAddress!)}
                    className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
                    title="Copy address"
                  >
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5">
                      <rect x="4" y="4" width="7" height="7" rx="1" />
                      <path d="M1 8V2a1 1 0 011-1h6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {deployResult.transactionHash && (
              <div>
                <p className="text-2xs text-text-muted mb-1">Transaction Hash</p>
                <code className="text-2xs font-mono text-text-secondary break-all">
                  {deployResult.transactionHash}
                </code>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              {deployResult.blockNumber && (
                <div className="bg-surface-2 rounded px-2 py-1.5">
                  <p className="text-2xs text-text-muted">Block</p>
                  <p className="text-sm font-mono text-text-primary">#{deployResult.blockNumber}</p>
                </div>
              )}
              {deployResult.gasUsed && (
                <div className="bg-surface-2 rounded px-2 py-1.5">
                  <p className="text-2xs text-text-muted">Gas Used</p>
                  <p className="text-sm font-mono text-text-primary">{deployResult.gasUsed.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!deployResult && status !== "deploying" && (
        <EmptyTerminal message="No deployments yet. Click Deploy to publish your contract." />
      )}
    </div>
  );
}

// ─── Shared ────────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    accent: "text-accent",
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
    muted: "text-text-muted",
  };
  return (
    <div className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-center">
      <p className={cn("text-xl font-mono font-semibold", colors[color] || "text-text-primary")}>{value}</p>
      <p className="text-2xs text-text-muted mt-0.5">{label}</p>
    </div>
  );
}

function EmptyTerminal({ message = "No output yet." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-24 text-center">
      <div className="text-text-dim font-mono text-xs">
        <span className="text-accent">$</span> _
      </div>
      <p className="text-xs text-text-muted mt-2">{message}</p>
    </div>
  );
}
