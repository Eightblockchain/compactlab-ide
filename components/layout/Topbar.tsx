"use client";

import { useIDEStore } from "@/store/ide";
import { Button, StatusDot, Divider } from "@/components/ui";
import { cn, formatAddress, generateId } from "@/lib/utils";
import { mockDeploy } from "@/lib/compact";
import { useState, useRef, useEffect } from "react";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import type { CompileResult } from "@/lib/compact";

export function Topbar() {
  const {
    activeProject,
    saveStatus,
    status,
    code,
    setStatus,
    setCompileResult,
    setDeployResult,
    addLog,
    clearLogs,
    setLogTab,
    setBottomPanelOpen,
    setWalletState,
    renameProject,
    setRightPanelTab,
    upsertGeneratedFiles,
  } = useIDEStore();

  const lace = useLaceWallet();

  // Sync Lace wallet state into the IDE store
  useEffect(() => {
    if (lace.status === "connected" && lace.walletInfo) {
      setWalletState({
        connected: true,
        address: lace.walletInfo.unshieldedAddress,
        balance: null,
        network: "Midnight Preprod",
      });
    } else if (lace.status === "disconnected" || lace.status === "error") {
      setWalletState({
        connected: false,
        address: null,
        balance: null,
        network: "Midnight Preprod",
      });
    }
  }, [lace.status, lace.walletInfo, setWalletState]);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRun = async () => {
    if (status !== "idle") return;
    clearLogs();
    setLogTab("compile");
    setBottomPanelOpen(true);
    setCompileResult(null);
    setStatus("compiling");

    addLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Starting compilation...", source: "compiler" });

    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await res.json() as CompileResult & { mock?: boolean; compilerVersion?: string; generatedFiles?: Array<{ name: string; language: "json" | "javascript" | "typescript"; content: string }> };

      if (result.success) {
        const circuitCount = result.circuitMetadata?.length ?? 0;
        const versionTag = result.compilerVersion ? ` (compact ${result.compilerVersion})` : result.mock ? " (mock)" : "";
        addLog({ id: generateId(), timestamp: Date.now(), level: "success", message: `Compilation successful${versionTag} — ${circuitCount} circuit(s) in ${result.duration}ms`, source: "compiler" });
        result.warnings?.forEach((w) => {
          addLog({ id: generateId(), timestamp: Date.now(), level: "warn", message: w, source: "compiler" });
        });
        result.circuitMetadata?.forEach((c) => {
          const params = c.inputs.map((i) => `${i.name}: ${i.type}`).join(", ");
          addLog({ id: generateId(), timestamp: Date.now(), level: "info", message: `  circuit ${c.name}(${params}) → ${c.output}`, source: "compiler" });
        });
        // Add/update generated files in the project tree
        if (result.generatedFiles && result.generatedFiles.length > 0) {
          upsertGeneratedFiles(result.generatedFiles);
          addLog({ id: generateId(), timestamp: Date.now(), level: "info", message: `  Generated ${result.generatedFiles.length} file(s) in generated/`, source: "compiler" });
        }
      } else {
        addLog({ id: generateId(), timestamp: Date.now(), level: "error", message: "Compilation failed", source: "compiler" });
        result.errors?.forEach((e) => {
          addLog({ id: generateId(), timestamp: Date.now(), level: "error", message: `  Line ${e.line}, Col ${e.column}: ${e.message}`, source: "compiler" });
        });
      }

      setCompileResult(result);
    } catch {
      addLog({ id: generateId(), timestamp: Date.now(), level: "error", message: "Compilation failed: could not reach compile service", source: "compiler" });
    }

    setStatus("idle");
  };

  const handleDeploy = async () => {
    if (status !== "idle") return;

    // Require Lace wallet
    if (lace.status !== "connected") {
      clearLogs();
      setLogTab("network");
      setBottomPanelOpen(true);
      if (!lace.isInstalled) {
        addLog({ id: generateId(), timestamp: Date.now(), level: "warn", message: "Midnight Lace wallet not detected. Install it from midnight.network/lace", source: "network" });
      } else {
        addLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Connecting to Lace wallet...", source: "network" });
        await lace.connect();
      }
      return;
    }

    // Compile first
    clearLogs();
    setLogTab("compile");
    setBottomPanelOpen(true);
    setStatus("compiling");
    addLog({ id: generateId(), timestamp: Date.now(), level: "info", message: "Starting compilation...", source: "compiler" });

    let compileResult: (CompileResult & { mock?: boolean }) | null = null;
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      compileResult = await res.json() as CompileResult & { mock?: boolean };
      setCompileResult(compileResult);
    } catch {
      addLog({ id: generateId(), timestamp: Date.now(), level: "error", message: "Compilation failed: could not reach compile service", source: "compiler" });
      setStatus("idle");
      return;
    }

    if (!compileResult?.success) {
      compileResult?.errors?.forEach((e) => {
        addLog({ id: generateId(), timestamp: Date.now(), level: "error", message: `  Line ${e.line}: ${e.message}`, source: "compiler" });
      });
      addLog({ id: generateId(), timestamp: Date.now(), level: "error", message: "Fix compilation errors before deploying", source: "compiler" });
      setStatus("idle");
      return;
    }

    addLog({ id: generateId(), timestamp: Date.now(), level: "success", message: "Compilation successful", source: "compiler" });

    // Deploy
    setLogTab("network");
    setStatus("deploying");
    const deployResult = await mockDeploy(addLog);
    setDeployResult(deployResult);
    setStatus("idle");

    if (deployResult.success) {
      setRightPanelTab("contract-ui");
    }
  };

  const startRename = () => {
    if (!activeProject) return;
    setNameValue(activeProject.name);
    setEditingName(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (activeProject && nameValue.trim()) {
      renameProject(activeProject.id, nameValue.trim());
    }
    setEditingName(false);
  };

  const isRunning = status !== "idle";

  return (
    <header className="h-14 flex items-center gap-2 px-4 bg-surface border-b border-border flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h4v4H3V4zM9 4h4v4H9V4zM3 9h4v4H3V9z" fill="white" />
            <path d="M9 9h4v4H9V9z" fill="white" opacity="0.4" />
          </svg>
        </div>
        <span className="font-semibold text-md text-text-primary tracking-tight">CompactLab</span>
        <span className="text-border-strong text-2xl leading-none select-none">/</span>
      </div>

      {/* Project name */}
      <div className="flex items-center gap-2 min-w-0">
        {editingName ? (
          <input
            ref={inputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditingName(false);
            }}
            className="bg-white/6 border border-border-strong rounded px-2 py-0.5 text-sm text-text-primary focus:outline-none focus:border-accent/60 w-44"
            autoFocus
          />
        ) : (
          <button
            onClick={startRename}
            className="text-sm text-text-primary hover:text-white font-medium truncate max-w-44 hover:bg-white/5 rounded px-1.5 py-0.5 transition-colors"
            title="Click to rename"
          >
            {activeProject?.name ?? "Untitled"}
          </button>
        )}

        {/* Save status */}
        <div className="flex items-center gap-1">
          {saveStatus === "saved" && (
            <span className="text-xs text-text-muted">Saved</span>
          )}
          {saveStatus === "saving" && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <span className="w-1 h-1 bg-warning rounded-full status-pulse" />
              Saving…
            </span>
          )}
          {saveStatus === "unsaved" && (
            <span className="text-xs text-warning">Unsaved</span>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Step indicator */}
      {isRunning && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs mr-2">
          <StepBadge step={1} label="Edit" done />
          <div className="w-4 h-px bg-border" />
          <StepBadge step={2} label="Compile" active={status === "compiling"} done={status === "deploying"} />
          <div className="w-4 h-px bg-border" />
          <StepBadge step={3} label="Simulate" />
          <div className="w-4 h-px bg-border" />
          <StepBadge step={4} label="Deploy" active={status === "deploying"} />
        </div>
      )}

      {/* Status */}
      {isRunning && (
        <StatusDot
          status="running"
          label={
            status === "compiling" ? "Compiling…" :
            status === "simulating" ? "Simulating…" :
            status === "deploying" ? "Deploying…" :
            "Running…"
          }
          className="mr-1"
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="md"
          onClick={handleRun}
          loading={status === "compiling"}
          disabled={isRunning}
          className="gap-1.5"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 2.5L10 6L2 9.5V2.5z" />
          </svg>
          Compile
        </Button>

        <Button
          variant="accent"
          size="md"
          onClick={handleDeploy}
          loading={status === "deploying"}
          disabled={isRunning}
          className="gap-1.5"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v7M3 5l3-4 3 4M1 10h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Deploy
        </Button>

        <Divider vertical className="mx-1 h-5" />

        {/* Wallet */}
        {lace.status === "connected" && lace.walletInfo ? (
          <button
            onClick={lace.disconnect}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 h-7",
              "border border-success/20 bg-success/8 text-success text-sm font-medium",
              "hover:bg-success/12 transition-colors"
            )}
            title="Connected to Lace — click to disconnect"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {formatAddress(lace.walletInfo.unshieldedAddress)}
          </button>
        ) : lace.status === "error" ? (
          <button
            onClick={lace.connect}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 h-7",
              "border border-error/30 bg-error/8 text-error text-sm font-medium",
              "hover:bg-error/12 transition-colors"
            )}
            title={lace.error ?? "Wallet error — click to retry"}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-error" />
            Retry
          </button>
        ) : (
          <Button
            variant="default"
            size="md"
            onClick={lace.isInstalled ? lace.connect : () => window.open("https://midnight.network/lace", "_blank")}
            loading={lace.status === "connecting"}
            disabled={lace.status === "connecting"}
            className="gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="1" y="4" width="12" height="8" rx="1.5" />
              <path d="M1 7h12M10 8.5h.5" strokeLinecap="round" />
            </svg>
            {!lace.isInstalled ? "Install Lace" : lace.status === "connecting" ? "Connecting…" : "Connect Wallet"}
          </Button>
        )}
      </div>
    </header>
  );
}

function StepBadge({ step, label, active, done }: { step: number; label: string; active?: boolean; done?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors",
      active && "bg-accent/15 text-accent",
      done && "text-text-secondary",
      !active && !done && "text-text-muted"
    )}>
      <span className={cn(
        "w-3.5 h-3.5 rounded-sm flex items-center justify-center text-2xs font-mono",
        active && "bg-accent text-white",
        done && "bg-white/10 text-text-secondary",
        !active && !done && "bg-white/5 text-text-dim"
      )}>
        {done ? "✓" : step}
      </span>
      <span>{label}</span>
    </div>
  );
}
