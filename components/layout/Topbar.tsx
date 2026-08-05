"use client";

import { useIDEStore } from "@/store/ide";
import { Button, StatusDot, Divider } from "@/components/ui";
import { cn, formatAddress, generateId } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import { listMidnightWallets } from "@/lib/wallet-detect";
import { MIDNIGHT_WALLET_LINKS } from "@/lib/wallet-links";
import type { CompileResult, DeployResult } from "@/lib/compact";
import { compileCompact, makeLog, extractWitnesses } from "@/lib/compact";
import {
  deployPlaygroundContract,
} from "@/lib/playground-deploy";
import { getDeployGate, getLiveCompactSource } from "@/lib/deploy-gate";
import { exportProjectZip, downloadBlob } from "@/lib/project-export";

function countMidnightWallets(): number {
  return listMidnightWallets().length;
}

export function Topbar() {
  const {
    activeProject,
    activeFile,
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
    setCode,
    witnessValues,
    activeFileId,
    tabBuffers,
  } = useIDEStore();

  const lace = useLaceWallet();

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

  useEffect(() => {
    if (lace.status === "error" && lace.error) {
      addLog(makeLog("error", `Wallet: ${lace.error}`, "network"));
      setLogTab("network");
      setBottomPanelOpen(true);
    }
  }, [lace.status, lace.error, addLog, setLogTab, setBottomPanelOpen]);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const walletPickerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (walletPickerRef.current && !walletPickerRef.current.contains(e.target as Node)) {
        setShowWalletPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const resolveCompactCode = (): { code: string; ok: boolean } => {
    let compileCode = code;
    if (activeFile?.language !== "compact") {
      const compactFile = activeProject?.files.find((f) => f.language === "compact");
      if (!compactFile) {
        addLog(makeLog("error", "No Compact contract file (.compact) found in this project.", "compiler"));
        return { code: "", ok: false };
      }
      addLog(makeLog("warn", `Compiling ${compactFile.name} (not the currently open file)`, "compiler"));
      compileCode = compactFile.content;
    }
    return { code: compileCode, ok: true };
  };

  const handleCompile = async (zk: boolean) => {
    if (status !== "idle") return;
    clearLogs();
    setLogTab("compile");
    setBottomPanelOpen(true);
    setCompileResult(null);
    setStatus("compiling");

    const resolved = resolveCompactCode();
    if (!resolved.ok) {
      setStatus("idle");
      return;
    }

    addLog(
      makeLog(
        "info",
        zk
          ? "Starting full Compact compile (produces contract/, keys/, zkir/, compiler/)…"
          : "Starting Compact typecheck with --skip-zk (no proving keys)…",
        "compiler",
      ),
    );

    const result = await compileCompact(resolved.code, {
      projectId: activeProject?.id,
      zk,
    });

    if (result.pragmaNormalized && result.normalizedCode) {
      setCode(result.normalizedCode);
      addLog(
        makeLog(
          "info",
          "Updated pragma to language version >= 0.22 (compiler package +0.30.0 implements language 0.22.0).",
          "compiler",
        ),
      );
    }

    if (result.success) {
      const circuitCount = result.circuitMetadata?.length ?? 0;
      const versionTag = result.compilerVersion ? ` (compact ${result.compilerVersion})` : "";
      const mode = result.skipZk
        ? "typecheck (--skip-zk, no proving keys)"
        : "full ZK compile";
      addLog(
        makeLog(
          "success",
          `${mode} OK${versionTag}: ${circuitCount} circuit(s) in ${result.duration}ms`,
          "compiler",
        ),
      );
      if (result.stdoutHint) addLog(makeLog("info", result.stdoutHint, "compiler"));
      if (result.artifacts) {
        const { contract, keys, zkir, compiler } = result.artifacts;
        addLog(
          makeLog(
            "info",
            `Artifacts: contract/[${contract.join(", ") || "-"}]  keys/[${keys.join(", ") || "NONE"}]  zkir/[${zkir.join(", ") || "-"}]  compiler/[${compiler.join(", ") || "-"}]`,
            "compiler",
          ),
        );
        if (result.skipZk) {
          addLog(
            makeLog(
              "warn",
              "Per Midnight docs, --skip-zk skips proving keys. Use Compile (not Typecheck) for deployable keys/.",
              "compiler",
            ),
          );
        }
      }
      result.warnings?.forEach((w) => addLog(makeLog("warn", w, "compiler")));
      result.circuitMetadata?.forEach((c) => {
        const params = c.inputs.map((i) => `${i.name}: ${i.type}`).join(", ");
        addLog(makeLog("info", `circuit ${c.name}(${params}) → ${c.output}`, "compiler"));
      });
      if (result.artifactBaseUrl) {
        addLog(makeLog("success", `Persisted ZK artifacts at ${result.artifactBaseUrl}`, "compiler"));
        addLog(
          makeLog(
            "info",
            `Stored privately under .data (served at ${result.artifactBaseUrl}/…).`,
            "compiler",
          ),
        );
      }
      if (result.generatedFiles && result.generatedFiles.length > 0) {
        upsertGeneratedFiles(result.generatedFiles);
        addLog(
          makeLog(
            "info",
            `Mirrored ${result.generatedFiles.length} artifact(s) into contracts/managed/ (keys are binary stubs)`,
            "compiler",
          ),
        );
      }
    } else {
      const errorCount = result.errors?.length ?? 0;
      addLog(
        makeLog(
          "error",
          `Compilation failed: ${errorCount} error${errorCount !== 1 ? "s" : ""}`,
          "compiler",
        ),
      );
      result.errors?.forEach((e) => {
        addLog(makeLog("error", `Line ${e.line}, Col ${e.column}: ${e.message}`, "compiler"));
      });
      if (result.installHint) addLog(makeLog("info", result.installHint, "compiler"));
    }

    setCompileResult(result);
    setStatus("idle");
  };

  const handleDeploy = async () => {
    if (status !== "idle") return;

    const template = activeProject?.template ?? "";
    const artifactBaseUrl = activeProject?.artifactBaseUrl;
    const compactSource = getLiveCompactSource({
      files: activeProject?.files ?? [],
      activeFileId,
      code,
      tabBuffers,
    });
    const gate = getDeployGate({
      template,
      artifactBaseUrl,
      compiledSourceHash: activeProject?.compiledSourceHash,
      currentSource: compactSource,
    });

    if (!gate.canDeploy) {
      setLogTab("compile");
      setBottomPanelOpen(true);
      addLog(makeLog("error", gate.reason, "compiler"));
      if (gate.needsCompile) {
        addLog(
          makeLog(
            "info",
            "Click Compile (full ZK) to generate proving keys for your current source, then Deploy.",
            "compiler",
          ),
        );
      }
      return;
    }

    clearLogs();
    setBottomPanelOpen(true);

    if (gate.usingBundled) {
      addLog(
        makeLog(
          "info",
          "Deploying bundled Preprod assets for this template (source matches the original). Edit + Compile to deploy your own keys.",
          "network",
        ),
      );
    }

    let connectedAPI = lace.connectedAPI;
    if (!connectedAPI) {
      setLogTab("network");
      addLog(makeLog("info", "Connecting to Midnight wallet…", "network"));
      connectedAPI = await lace.connect();
      if (!connectedAPI) {
        addLog(
          makeLog(
            "error",
            lace.error ??
              "Could not connect. Install 1AM from https://1am.xyz/, unlock it, approve this site, then retry.",
            "network",
          ),
        );
        return;
      }
      addLog(makeLog("success", "Wallet connected.", "network"));
    }

    addLog(makeLog("info", "Need tDUST for fees: https://faucet.preprod.midnight.network/", "network"));

    const compactFile = activeProject?.files.find((f) => f.language === "compact");
    if (!compactFile) {
      addLog(makeLog("error", "No Compact contract file (.compact) found in this project.", "compiler"));
      return;
    }

    // Bundled Instant Deploy: skip server Compile (no CLI required).
    // Edited / custom projects already gated to require full ZK Compile first.
    if (!gate.usingBundled) {
      setLogTab("compile");
      setStatus("compiling");
      let compileResult: CompileResult;
      try {
        compileResult = await compileCompact(compactFile.content, {
          projectId: activeProject?.id,
          zk: false,
        });
        setCompileResult(compileResult);
      } catch {
        addLog(makeLog("error", "Compilation failed: could not reach compile service", "compiler"));
        setStatus("idle");
        return;
      }

      if (!compileResult.success) {
        const errCount = compileResult.errors?.length ?? 0;
        addLog(makeLog("error", `Compilation failed: ${errCount} error(s). Fix before deploying.`, "compiler"));
        compileResult.errors?.forEach((e) => {
          addLog(makeLog("error", `Line ${e.line}, Col ${e.column}: ${e.message}`, "compiler"));
        });
        setStatus("idle");
        return;
      }

      addLog(makeLog("success", "Syntax/typecheck OK", "compiler"));
    } else {
      addLog(makeLog("info", "Skipping server typecheck (bundled Instant Deploy).", "compiler"));
    }

    // Witness *values* are not required at deploy (constructor typically does not
    // call them). Official bboard seeds a random private state bag for the SDK.
    // User-supplied values are required later at Call.
    const witnessSpecs = extractWitnesses(compactFile.content);

    setLogTab("network");
    setStatus("deploying");

    let deployResult: DeployResult;
    try {
      deployResult = await deployPlaygroundContract(
        connectedAPI,
        template,
        addLog,
        {
          artifactBaseUrl,
          projectId: activeProject?.id,
          witnessSpecs,
          // Optional at deploy — used only if the user already filled Contract UI
          witnessValues,
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(makeLog("error", `Deploy failed: ${message}`, "network"));
      deployResult = { success: false, duration: 0, error: message };
    }

    setDeployResult(deployResult);
    setStatus("idle");
    if (deployResult.success) {
      setRightPanelTab("contract-ui");
      addLog(
        makeLog(
          "success",
          "Next: open Contract UI on the right, then Call a circuit (e.g. storeMessage / increment). Proofs take 1-2 min.",
          "network",
        ),
      );
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
  const liveSource = getLiveCompactSource({
    files: activeProject?.files ?? [],
    activeFileId,
    code,
    tabBuffers,
  });
  const deployGate = getDeployGate({
    template: activeProject?.template ?? "",
    artifactBaseUrl: activeProject?.artifactBaseUrl,
    compiledSourceHash: activeProject?.compiledSourceHash,
    currentSource: liveSource,
  });
  const deployEnabled = !isRunning && deployGate.canDeploy;

  const handleExport = async () => {
    if (!activeProject || exporting) return;
    setExporting(true);
    try {
      const snap = {
        ...activeProject,
        files: activeProject.files.map((f) =>
          activeFile && f.id === activeFile.id ? { ...f, content: code } : f,
        ),
      };
      const blob = await exportProjectZip(snap);
      downloadBlob(blob, `${snap.slug || "compact-project"}.zip`);
      addLog(makeLog("success", `Exported ${snap.name} as zip`, "network"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(makeLog("error", `Export failed: ${message}`, "network"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="h-14 flex items-center gap-2 px-4 bg-surface border-b border-border flex-shrink-0">
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

        <div className="flex items-center gap-1">
          {saveStatus === "saved" && <span className="text-xs text-text-muted">Saved</span>}
          {saveStatus === "saving" && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <span className="w-1 h-1 bg-warning rounded-full status-pulse" />
              Saving…
            </span>
          )}
          {saveStatus === "unsaved" && <span className="text-xs text-warning">Unsaved</span>}
        </div>
      </div>

      <div className="flex-1" />

      {/* Live status */}
      <div className="hidden md:flex items-center gap-3 text-xs mr-2">
        <span className="flex items-center gap-1.5 text-text-muted" title="ZK proving via 1AM wallet">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              lace.status === "connected" ? "bg-success" : "bg-text-dim",
            )}
          />
          Prove {lace.status === "connected" ? "1AM" : "off"}
        </span>
        <span className="flex items-center gap-1.5 text-text-muted">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              lace.status === "connected"
                ? "bg-success"
                : lace.status === "error"
                  ? "bg-error"
                  : "bg-text-dim",
            )}
          />
          Wallet{" "}
          {lace.status === "connected"
            ? lace.connectedWalletName
              ? lace.connectedWalletName.slice(0, 12)
              : "on"
            : lace.status === "error"
              ? "error"
              : lace.status === "connecting"
                ? "…"
                : "off"}
        </span>
      </div>

      {isRunning && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs mr-2">
          <StepBadge step={1} label="Compile" active={status === "compiling"} done={status === "deploying"} />
          <div className="w-4 h-px bg-border" />
          <StepBadge step={2} label="Prove" active={status === "deploying"} />
          <div className="w-4 h-px bg-border" />
          <StepBadge step={3} label="Submit" active={status === "deploying"} />
        </div>
      )}

      {isRunning && (
        <StatusDot
          status="running"
          label={
            status === "compiling" ? "Compiling…" : status === "deploying" ? "Deploying…" : "Running…"
          }
          className="mr-1"
        />
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="md"
          onClick={() => void handleCompile(true)}
          loading={status === "compiling"}
          disabled={isRunning}
          className="gap-1.5"
          title="Full Compact compile (produces proving keys for your edits)"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 2.5L10 6L2 9.5V2.5z" />
          </svg>
          Compile
        </Button>

        <Button
          variant="default"
          size="md"
          onClick={() => void handleCompile(false)}
          loading={status === "compiling"}
          disabled={isRunning}
          className="gap-1.5"
          title="Fast syntax/type check only (no proving keys)"
        >
          Check syntax
        </Button>

        <Button
          variant="accent"
          size="md"
          onClick={() => void handleDeploy()}
          loading={status === "deploying"}
          disabled={!deployEnabled}
          className="gap-1.5"
          title={deployGate.reason}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v7M3 5l3-4 3 4M1 10h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Deploy
        </Button>

        <Button
          variant="default"
          size="md"
          onClick={() => void handleExport()}
          loading={exporting}
          disabled={!activeProject || exporting || isRunning}
          className="gap-1.5"
          title="Download project as zip (source + deployment.json + managed keys if present)"
        >
          Export
        </Button>

        <Divider vertical className="mx-1 h-5" />

        {lace.status === "connected" && lace.walletInfo ? (
          <button
            onClick={lace.disconnect}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 h-7",
              "border border-success/20 bg-success/8 text-success text-sm font-medium",
              "hover:bg-success/12 transition-colors",
            )}
            title={`Connected to ${lace.connectedWalletName ?? "wallet"} (click to disconnect)`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {formatAddress(lace.walletInfo.unshieldedAddress)}
          </button>
        ) : (
          <div className="relative" ref={walletPickerRef}>
            <Button
              variant={lace.status === "error" ? "accent" : "default"}
              size="md"
              onClick={() => {
                lace.refreshWallets();
                const count = countMidnightWallets();
                if (count === 0) {
                  setShowWalletPicker(true);
                  return;
                }
                if (count > 1) {
                  setShowWalletPicker((v) => !v);
                  return;
                }
                void lace.connect();
              }}
              loading={lace.status === "connecting"}
              disabled={lace.status === "connecting"}
              className="gap-1.5"
              title={
                lace.status === "error"
                  ? lace.error
                    ? `${lace.error} (click to retry)`
                    : "Connection failed (click to retry)"
                  : lace.isInstalled
                    ? "Connect 1AM wallet (Preprod)"
                    : "1AM not detected. Install from https://1am.xyz/ and reload"
              }
            >
              {lace.status === "connecting"
                ? "Connecting…"
                : lace.status === "error"
                  ? "Retry Wallet"
                  : !lace.isInstalled
                    ? "Install 1AM ▾"
                    : lace.availableWallets.length > 1
                      ? "Connect 1AM ▾"
                      : "Connect 1AM"}
            </Button>

            {showWalletPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] bg-surface-2 border border-border rounded-md shadow-lg overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border">
                  <span className="text-2xs text-text-muted uppercase tracking-wide">
                    {lace.availableWallets.length > 0 ? "Choose 1AM" : "Install 1AM"}
                  </span>
                </div>
                {lace.availableWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={async () => {
                      setShowWalletPicker(false);
                      await lace.connectTo(wallet);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-white/6 transition-colors"
                  >
                    {wallet.api.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={wallet.api.icon} alt="" className="w-5 h-5 rounded" />
                    ) : (
                      <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-2xs">
                        ■
                      </span>
                    )}
                    <span className="truncate">{wallet.api.name || wallet.id.slice(0, 8)}</span>
                  </button>
                ))}
                {lace.availableWallets.length === 0 &&
                  MIDNIGHT_WALLET_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block px-3 py-2 text-sm text-accent hover:bg-white/6 transition-colors"
                      onClick={() => setShowWalletPicker(false)}
                    >
                      {link.name} ↗
                    </a>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function StepBadge({
  step,
  label,
  active,
  done,
}: {
  step: number;
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors",
        active && "bg-accent/15 text-accent",
        done && "text-text-secondary",
        !active && !done && "text-text-muted",
      )}
    >
      <span
        className={cn(
          "w-3.5 h-3.5 rounded-sm flex items-center justify-center text-2xs font-mono",
          active && "bg-accent text-white",
          done && "bg-white/10 text-text-secondary",
          !active && !done && "bg-white/5 text-text-dim",
        )}
      >
        {done ? "✓" : step}
      </span>
      <span>{label}</span>
    </div>
  );
}
