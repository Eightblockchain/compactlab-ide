"use client";

import { useRef, useEffect } from "react";
import { useIDEStore } from "@/store/ide";
import { Tabs, Badge, Button, IconButton, StatusDot } from "@/components/ui";
import { cn, formatTimestamp } from "@/lib/utils";
import type { LogEntry } from "@/lib/compact";
import type { LogTab } from "@/store/ide";
import { compactEditorBridge } from "@/lib/compact-editor-bridge";
import { oneAmContractUrl, oneAmTxUrl } from "@/lib/explorers";
import { lintCompactSource } from "@/lib/compact-lint";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import { ZkArtifactsPanel } from "@/components/panels/ZkArtifactsPanel";
import { SPONSORED_FEES_ENABLED } from "@/lib/fee-mode";
import { NETWORKS } from "@/lib/network";
import { useActiveNetwork } from "@/lib/user-settings";

export function BottomPanel() {
  const { logTab, setLogTab, bottomPanelOpen, setBottomPanelOpen, logs, clearLogs, code, activeFile, compileResult } = useIDEStore();

  const lintCount =
    activeFile?.language === "compact"
      ? lintCompactSource(code).filter((d) => d.severity === "error").length
      : 0;
  const compileErrorCount = compileResult?.errors?.length ?? 0;
  const problemCount = compileErrorCount || lintCount;

  const tabs = [
    { id: "logs", label: "Logs", badge: logs.length > 0 ? logs.length : undefined },
    {
      id: "compile",
      label: "Compile",
      badge: problemCount > 0 ? problemCount : undefined,
    },
    { id: "network", label: "Network" },
  ];

  return (
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center h-8 border-b border-border bg-background flex-shrink-0">
        <Tabs
          tabs={tabs}
          activeTab={logTab}
          onTabChange={(id) => setLogTab(id as LogTab)}
          size="sm"
          className="px-1 h-full"
        />

        <div className="flex items-center gap-1 ml-auto pr-2">
          {logTab === "logs" && logs.length > 0 && (
            <Button variant="ghost" size="xs" onClick={clearLogs} className="text-text-muted">
              Clear
            </Button>
          )}
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
    <div className="h-full overflow-y-auto px-3 py-2 font-mono text-xs space-y-px">
      {logs.length === 0 ? (
        <EmptyTerminal />
      ) : (
        <>
          {logs.map((log) => (
            <LogLine key={log.id} log={log} />
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

function LogLine({ log }: { log: LogEntry }) {
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

  const isTypeHint = log.source === "typecheck";

  return (
    <div
      className={cn(
        "flex items-start gap-2 leading-relaxed terminal-line",
        isTypeHint ? "text-text-muted" : colors[log.level],
      )}
    >
      <span className="text-text-dim flex-shrink-0 tabular-nums">
        {formatTimestamp(log.timestamp)}
      </span>
      <span className="flex-shrink-0 w-16 truncate text-text-dim">
        {log.source ? (isTypeHint ? "hint" : log.source) : ""}
      </span>
      <span>
        <span className="opacity-60">{prefixes[log.level]}</span>
        {log.message}
      </span>
    </div>
  );
}

// ─── Compile Panel ────────────────────────────────────────────────────────────

function CompilePanel() {
  const { compileResult, status, setLogTab, code, activeFile } = useIDEStore();
  const lintIssues =
    activeFile?.language === "compact" ? lintCompactSource(code) : [];
  const showLintOnly = lintIssues.length > 0 && !compileResult && status !== "compiling";

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

      {!compileResult && status !== "compiling" && !showLintOnly && (
        <EmptyTerminal message="Run the compiler to see output. Editor shows inline hints as you type." />
      )}

      {showLintOnly && (
        <div>
          <p className="text-2xs text-warning uppercase tracking-wide font-semibold mb-2">
            Editor checks ({lintIssues.length})
          </p>
          <div className="space-y-1">
            {lintIssues.map((issue, i) => (
              <button
                key={i}
                type="button"
                onClick={() => compactEditorBridge.jumpTo(issue.line, issue.column)}
                className={cn(
                  "flex items-start gap-2 p-2 rounded text-xs w-full text-left transition-colors cursor-pointer border",
                  issue.severity === "error"
                    ? "bg-error/5 border-error/15 hover:bg-error/10"
                    : "bg-warning/5 border-warning/15 hover:bg-warning/10",
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 font-mono",
                    issue.severity === "error" ? "text-error" : "text-warning",
                  )}
                >
                  Line {issue.line}:{issue.column}
                </span>
                <span className="text-text-secondary">{issue.message}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                {compileResult.success
                  ? (compileResult.skipZk
                    ? "Typecheck OK (--skip-zk, no proving keys)"
                    : "Full Compact compile OK")
                  : "Compilation failed"}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {compileResult.duration}ms
                {compileResult.compilerVersion ? ` · compact ${compileResult.compilerVersion}` : ""}
                {compileResult.artifactBaseUrl ? ` · ${compileResult.artifactBaseUrl}` : ""}
              </p>
            </div>
          </div>

          {/* Stats */}
          {compileResult.success && (
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Keys"
                value={String(compileResult.artifacts?.keys.length ?? (compileResult.skipZk ? 0 : "n/a"))}
                color={compileResult.artifacts?.keys.length ? "accent" : "warning"}
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

          {compileResult.success && compileResult.artifacts && (
            <div className="text-xs font-mono text-text-secondary space-y-1 p-3 bg-surface-2 border border-border rounded-md">
              <p>contract/: {compileResult.artifacts.contract.join(", ") || "none"}</p>
              <p>keys/: {compileResult.artifacts.keys.join(", ") || "(empty - not deployable)"}</p>
              <p>zkir/: {compileResult.artifacts.zkir.join(", ") || "none"}</p>
              <p>compiler/: {compileResult.artifacts.compiler.join(", ") || "none"}</p>
            </div>
          )}

          {compileResult.success && !compileResult.skipZk && (
            <div className="p-3 bg-surface-2 border border-border rounded-md">
              <ZkArtifactsPanel />
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
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      compactEditorBridge.jumpTo(err.line, err.column);
                      setLogTab("compile");
                    }}
                    className="flex items-start gap-2 p-2 bg-error/5 border border-error/15 rounded text-xs w-full text-left hover:bg-error/10 transition-colors cursor-pointer"
                  >
                    <span className="text-error flex-shrink-0 font-mono">Line {err.line}:{err.column}</span>
                    <span className="text-text-secondary">{err.message}</span>
                  </button>
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
  const { wallet, deployResult, status, feeMode, sponsorStatus, setDeployResult } = useIDEStore();
  const lace = useLaceWallet();
  const network = useActiveNetwork();
  const deployedOn = NETWORKS[deployResult?.network ?? "preprod"];
  const dustEmpty = lace.dustBalance?.isEmpty === true;
  const dustUnknown = wallet.connected && !lace.dustBalance && wallet.balance === "Loading…";

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Wallet status */}
      <div>
        <p className="text-2xs text-text-muted uppercase tracking-wide font-semibold mb-2">Wallet</p>
        <div className="p-3 bg-surface-2 border border-border rounded-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Fee mode</span>
            <span className="text-xs text-text-primary">
              {SPONSORED_FEES_ENABLED && network.sponsorship && feeMode === "sponsored" ? "Sponsored" : "Self-pay"}
            </span>
          </div>
          {SPONSORED_FEES_ENABLED && network.sponsorship && feeMode === "sponsored" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-muted">Sponsor</span>
                <span
                  className={cn(
                    "text-xs",
                    sponsorStatus?.healthy
                      ? "text-success"
                      : sponsorStatus?.syncing
                        ? "text-text-secondary"
                        : "text-warning",
                  )}
                  title={sponsorStatus?.reason ?? undefined}
                >
                  {!sponsorStatus
                    ? "Checking…"
                    : sponsorStatus.healthy
                      ? "Healthy"
                      : sponsorStatus.syncing
                        ? "Syncing…"
                        : sponsorStatus.reason || "Unavailable"}
                </span>
              </div>
              {sponsorStatus?.unshieldedAddress && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-text-muted">Sponsor addr</span>
                  <span
                    className="text-xs font-mono text-text-secondary truncate max-w-[60%]"
                    title={sponsorStatus.unshieldedAddress}
                  >
                    {sponsorStatus.unshieldedAddress}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Status</span>
            <StatusDot
              status={wallet.connected ? "success" : "idle"}
              label={wallet.connected ? "Connected (1AM)" : "Disconnected"}
            />
          </div>
          {wallet.connected && wallet.address && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-muted">Address</span>
                <span className="text-xs font-mono text-text-secondary truncate max-w-[60%]" title={wallet.address}>
                  {wallet.address.slice(0, 10)}…{wallet.address.slice(-6)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-muted">tDUST</span>
                <span
                  className={cn(
                    "text-xs font-mono",
                    dustEmpty ? "text-warning" : "text-text-primary",
                  )}
                  title="Spendable Dust from 1AM getDustBalance()"
                >
                  {wallet.balance ?? "n/a"}
                </span>
              </div>
              {wallet.dustCap && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-text-muted">tDUST cap</span>
                  <span
                    className="text-xs font-mono text-text-secondary"
                    title="Max Dust generable from your current tNIGHT"
                  >
                    {wallet.dustCap}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Network</span>
                <span className="text-xs font-mono text-info">{wallet.network}</span>
              </div>
              {(dustEmpty || dustUnknown) && (
                <p className="text-2xs text-warning leading-relaxed pt-1 border-t border-border/60">
                  {dustEmpty
                    ? "tDUST is 0. Fund tNIGHT from the faucet and wait for Dust generation before Deploy or Call."
                    : "Could not read Dust yet. Click refresh or reconnect 1AM."}
                  {" "}
                  <a
                    href={network.faucetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    Faucet
                  </a>
                  {" · "}
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => void lace.refreshDustBalance()}
                  >
                    Refresh
                  </button>
                </p>
              )}
              {!dustEmpty && lace.dustBalance && (
                <p className="text-2xs text-text-dim leading-relaxed pt-1 border-t border-border/60">
                  Exact Deploy fees vary by proof size. Refresh before Deploy if unsure.{" "}
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => void lace.refreshDustBalance()}
                  >
                    Refresh tDUST
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Deploy status */}
      {status === "deploying" && (
        <div className="flex items-center gap-3 p-4 bg-accent/5 border border-accent/15 rounded-md">
          <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-text-primary">Deploying to Midnight {network.label}…</p>
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
                {deployResult.success ? "Deployed successfully" : "Last deploy attempt failed"}
              </span>
              <span className="ml-auto text-xs text-text-muted">{deployResult.duration}ms</span>
              {!deployResult.success && (
                <button
                  type="button"
                  onClick={() => setDeployResult(null)}
                  className="text-2xs text-text-muted hover:text-text-primary"
                >
                  Dismiss
                </button>
              )}
            </div>

            {!deployResult.success && (
              <p className="text-2xs text-text-muted leading-relaxed">
                This is a saved result from an earlier Deploy, not from connecting your wallet.
                Connecting 1AM does not submit a deploy transaction.
              </p>
            )}

            {!deployResult.success && deployResult.error && (
              <div className="mt-1 p-2 bg-error/5 border border-error/15 rounded text-xs font-mono text-error/90 break-all select-text">
                {deployResult.error}
              </div>
            )}

            {deployResult.contractAddress && (
              <div>
                <p className="text-2xs text-text-muted mb-1">Contract Address</p>
                <div className="flex items-center gap-2">
                  <a
                    href={oneAmContractUrl(deployResult.contractAddress, deployedOn.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-success break-all flex-1 hover:underline"
                    title={`View contract on 1AM Explorer (${deployedOn.label})`}
                  >
                    {deployResult.contractAddress}
                  </a>
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={oneAmContractUrl(deployResult.contractAddress, deployedOn.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-accent hover:opacity-90 transition-opacity"
                  >
                    View contract
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3 h-3">
                      <path d="M5 2H2.5A1.5 1.5 0 001 3.5v6A1.5 1.5 0 002.5 11h6A1.5 1.5 0 0010 9.5V7M7 1h4v4M11 1L5.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                  {deployResult.transactionHash && (
                    <a
                      href={oneAmTxUrl(deployResult.transactionHash, deployedOn.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-2xs text-accent hover:underline"
                    >
                      View deploy tx ↗
                    </a>
                  )}
                </div>
                <p className="text-2xs text-text-dim mt-1.5">
                  Opens 1AM {deployedOn.label} explorer. Compact contracts are hex ids, not wallet accounts.
                </p>
              </div>
            )}

            {deployResult.transactionHash && (
              <div>
                <p className="text-2xs text-text-muted mb-1">Transaction Hash</p>
                <a
                  href={oneAmTxUrl(deployResult.transactionHash, deployedOn.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-2xs font-mono text-text-secondary break-all hover:text-accent hover:underline"
                >
                  {deployResult.transactionHash}
                </a>
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
      <p className="text-xs text-text-dim">{message}</p>
    </div>
  );
}
