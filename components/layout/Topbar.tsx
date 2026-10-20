"use client";

import { useIDEStore } from "@/store/ide";
import { Button, StatusDot, Divider } from "@/components/ui";
import { cn, generateId } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import { useAuth } from "@/hooks/useAuth";
import type { DeployResult } from "@/lib/compact";
import { compileCompact, makeLog, extractWitnesses } from "@/lib/compact";
import { getConstructorMeta, resolveConstructorParams } from "@/lib/compact-constructor";
import { typeEnvFromCompactSource, validateCompactParams } from "@/lib/compact-values";
import { deployPlaygroundContract } from "@/lib/playground-deploy";
import { getDeployGate, getLiveCompactSource } from "@/lib/deploy-gate";
import { exportProjectZip, downloadBlob } from "@/lib/project-export";
import type { UserPublic, Entitlements } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import { BILLING_ENABLED } from "@/lib/billing";
import {
  SPONSORED_FEES_ENABLED,
  feeModeHelp,
  feeModeLabel,
  type FeeMode,
  type SponsorStatusResponse,
} from "@/lib/fee-mode";
import {
  SponsorFallbackModal,
  type SponsorFallbackChoice,
} from "@/components/modals/SponsorFallbackModal";
import {
  DeployProgressModal,
  type DeployUiStage,
} from "@/components/modals/DeployProgressModal";
import { DeployConstructorModal } from "@/components/modals/DeployConstructorModal";
import { CompactLabLogo } from "@/components/brand/CompactLabLogo";
import dynamic from "next/dynamic";

const SettingsModal = dynamic(
  () => import("@/components/modals/SettingsModal").then((m) => m.SettingsModal),
  { ssr: false },
);

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
    clearLogsBySource,
    setLogTab,
    setBottomPanelOpen,
    setWalletState,
    renameProject,
    setRightPanelTab,
    upsertGeneratedFiles,
    setCode,
    witnessValues,
    constructorValues,
    setConstructorValues,
    compileResult,
    activeFileId,
    tabBuffers,
    feeMode,
    setFeeMode,
    sponsorStatus,
    setSponsorStatus,
    deployResult,
  } = useIDEStore();

  const lace = useLaceWallet();
  const { user, entitlements, logout, checkout, portal } = useAuth();
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deployStage, setDeployStage] = useState<DeployUiStage>("connect");
  const [deployStartedAt, setDeployStartedAt] = useState(0);
  const [sponsorPrompt, setSponsorPrompt] = useState<{
    reason: string;
    syncing: boolean;
    resolve: (choice: SponsorFallbackChoice) => void;
  } | null>(null);
  const [ctorPrompt, setCtorPrompt] = useState<{
    params: Array<{ name: string; type: string }>;
    values: Record<string, string>;
    resolve: (values: Record<string, string> | null) => void;
  } | null>(null);

  const askSponsorFallback = useCallback(
    (reason: string, syncing: boolean) =>
      new Promise<SponsorFallbackChoice>((resolve) => {
        setSponsorPrompt({ reason, syncing, resolve });
      }),
    [],
  );

  useEffect(() => {
    if (lace.status === "connected" && lace.walletInfo) {
      setWalletState({
        connected: true,
        address: lace.walletInfo.unshieldedAddress,
        balance: lace.dustBalance
          ? `${lace.dustBalance.balanceLabel} tDUST`
          : "Loading…",
        dustCap: lace.dustBalance ? `${lace.dustBalance.capLabel} tDUST` : null,
        network: "Midnight Preprod",
      });
    } else if (lace.status === "disconnected" || lace.status === "error") {
      setWalletState({
        connected: false,
        address: null,
        balance: null,
        dustCap: null,
        network: "Midnight Preprod",
      });
    }
  }, [lace.status, lace.walletInfo, lace.dustBalance, setWalletState]);

  useEffect(() => {
    if (lace.status === "error" && lace.error) {
      addLog(makeLog("error", `Wallet: ${lace.error}`, "network"));
      setLogTab("network");
      setBottomPanelOpen(true);
    }
  }, [lace.status, lace.error, addLog, setLogTab, setBottomPanelOpen]);

  // Poll CompactLab sponsor health only when the experimental Sponsored flag is on.
  useEffect(() => {
    if (!SPONSORED_FEES_ENABLED || !user) {
      if (useIDEStore.getState().sponsorStatus !== null) {
        setSponsorStatus(null);
      }
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await apiFetch("/v1/sponsor/status");
        const text = await res.text();
        let body: SponsorStatusResponse | { error?: string } = {
          enabled: false,
          healthy: false,
          configured: false,
          dustBalance: null,
          dustCap: null,
          reason: "Could not reach sponsor status",
        };
        try {
          body = text
            ? (JSON.parse(text) as SponsorStatusResponse)
            : body;
        } catch {
          /* keep fallback */
        }
        if (cancelled) return;
        if (!res.ok) {
          setSponsorStatus({
            enabled: false,
            healthy: false,
            configured: false,
            dustBalance: null,
            dustCap: null,
            reason:
              (body as { error?: string }).error ||
              `Sponsor status ${res.status}`,
          });
          return;
        }
        const status = body as SponsorStatusResponse;
        setSponsorStatus(status);
      } catch (err) {
        if (!cancelled) {
          setSponsorStatus({
            enabled: false,
            healthy: false,
            configured: false,
            dustBalance: null,
            dustCap: null,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, setSponsorStatus]);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

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
          "Updated pragma to language version >= 0.23 (compiler package +0.31.1 implements language 0.23.0).",
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
      clearLogsBySource("typecheck");
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
            "Flow: Compile (full ZK) → Connect 1AM → Deploy. Hello/Counter can Deploy with bundled keys if unedited.",
            "compiler",
          ),
        );
      }
      return;
    }

    if (!compactSource.trim()) {
      addLog(makeLog("error", "No Compact contract file (.compact) found in this project.", "network"));
      return;
    }

    const witnessSpecs = extractWitnesses(compactSource);
    const ctorMeta = getConstructorMeta(
      compactSource,
      witnessSpecs.map((w) => w.name),
    );
    const ctorParamsResolved = resolveConstructorParams({
      code: compactSource,
      constructorMetadata: compileResult?.constructorMetadata?.inputs,
      generatedDts:
        compileResult?.generatedFiles?.find(
          (f) => f.path === "contract/index.d.ts" || f.name === "index.d.ts",
        )?.content ?? null,
    });
    const ctorParams =
      ctorMeta.inputs.length > 0 ? ctorMeta.inputs : ctorParamsResolved;
    const typeEnv = typeEnvFromCompactSource(compactSource);

    let ctorValues = { ...useIDEStore.getState().constructorValues };
    if (ctorParams.length > 0) {
      const filled = await new Promise<Record<string, string> | null>((resolve) => {
        setCtorPrompt({ params: ctorParams, values: ctorValues, resolve });
      });
      if (!filled) {
        addLog(makeLog("info", "Deploy cancelled: constructor arguments not provided.", "network"));
        return;
      }
      ctorValues = filled;
      setConstructorValues(filled);
      addLog(
        makeLog(
          "info",
          `Constructor args: ${ctorParams.map((p) => `${p.name}=${filled[p.name] ?? ""}`).join(", ")}`,
          "network",
        ),
      );
    }

    const started = Date.now();
    const failDeploy = (error: string): DeployResult => {
      addLog(makeLog("error", error, "network"));
      const outcome: DeployResult = { success: false, duration: Date.now() - started, error };
      setDeployResult(outcome);
      setStatus("idle");
      return outcome;
    };

    clearLogs();
    setBottomPanelOpen(true);
    setLogTab("network");
    setDeployResult(null);
    setDeployStartedAt(started);
    setDeployStage("connect");
    setDeployModalOpen(true);
    setStatus("deploying");

    if (gate.usingBundled) {
      addLog(
        makeLog(
          "info",
          "Deploying bundled Preprod assets for Hello/Counter (source matches template). You can Compile first if you want your own keys.",
          "network",
        ),
      );
    } else {
      addLog(
        makeLog(
          "info",
          "Deploying with your last Compile (ZK) artifacts. CompactLab requires the 1AM wallet (https://1am.xyz/).",
          "network",
        ),
      );
    }

    let connectedAPI = lace.connectedAPI;
    if (!connectedAPI) {
      setDeployStage("connect");
      addLog(makeLog("info", "Connecting to 1AM wallet…", "network"));
      connectedAPI = await lace.connect();
      if (!connectedAPI) {
        failDeploy(
          lace.error ??
            "Could not connect. CompactLab only supports 1AM (https://1am.xyz/). Install it, unlock it, set Preprod, approve this site, then retry.",
        );
        return;
      }
      addLog(makeLog("success", "1AM connected.", "network"));
    }

    setDeployStage("fees");
    addLog(makeLog("info", "Checking tDUST balance before Deploy…", "network"));
    let userDustEmpty = false;
    try {
      const dust = await lace.refreshDustBalance();
      if (dust) {
        addLog(
          makeLog(
            "info",
            `tDUST balance: ${dust.balanceLabel} (cap ${dust.capLabel})`,
            "network",
          ),
        );
        userDustEmpty = dust.isEmpty;
      }
    } catch {
      /* balance probe is best-effort; Deploy still proceeds if 1AM cannot report it */
    }

    let deployFeeMode = SPONSORED_FEES_ENABLED ? feeMode : "self";
    if (deployFeeMode === "self" && userDustEmpty) {
      failDeploy(
        "Your tDUST balance is 0. Fund tNIGHT at https://faucet.preprod.midnight.network/ , wait for Dust generation, then retry Deploy.",
      );
      return;
    }

    if (SPONSORED_FEES_ENABLED && deployFeeMode === "sponsored") {
      let status = sponsorStatus;
      try {
        const res = await apiFetch("/v1/sponsor/status");
        if (res.ok) {
          status = (await res.json()) as SponsorStatusResponse;
          setSponsorStatus(status);
        }
      } catch {
        /* keep cached */
      }

      if (!status?.healthy) {
        if (!userDustEmpty) {
          const choice = await askSponsorFallback(
            status?.reason ??
              "Sponsor is not healthy yet. You can pay fees yourself with tDUST.",
            Boolean(status?.syncing),
          );
          if (choice === "cancel") {
            addLog(
              makeLog(
                "info",
                "Deploy cancelled: waiting for Sponsored fees, or try again later.",
                "network",
              ),
            );
            setDeployModalOpen(false);
            setStatus("idle");
            return;
          }
          deployFeeMode = "self";
          setFeeMode("self");
          addLog(
            makeLog(
              "warn",
              "You chose Self-pay for this Deploy. Topbar switched to Self-pay.",
              "network",
            ),
          );
        } else {
          failDeploy(
            status?.reason
              ? `Sponsor unavailable: ${status.reason} Your tDUST is also 0. Wait for the sponsor, or fund Self-pay.`
              : "Sponsor temporarily unavailable and your tDUST is 0; wait or retry later.",
          );
          return;
        }
      } else {
        addLog(
          makeLog(
            "info",
            "Sponsor healthy. Deploying with CompactLab-sponsored fees.",
            "network",
          ),
        );
      }
    }

    const compactFile = activeProject?.files.find((f) => f.language === "compact");
    if (!compactFile && !compactSource.trim()) {
      failDeploy("No Compact contract file (.compact) found in this project.");
      return;
    }

    const ctorErr = validateCompactParams(
      ctorParams,
      ctorValues,
      "Constructor parameter",
      typeEnv,
    );
    if (ctorErr) {
      failDeploy(ctorErr);
      return;
    }
    if (ctorMeta.usesWitnesses) {
      const { validateWitnessValues } = await import("@/lib/playground-witnesses");
      const wErr = validateWitnessValues(witnessSpecs, witnessValues);
      if (wErr) {
        failDeploy(
          `${wErr.replace("before Call", "before Deploy")} Constructor calls witness(es); set Private witnesses in the Contract panel.`,
        );
        setRightPanelTab("contract-ui");
        return;
      }
    }

    let outcome: DeployResult;
    try {
      outcome = await deployPlaygroundContract(
        connectedAPI,
        template,
        addLog,
        {
          artifactBaseUrl,
          projectId: activeProject?.id,
          witnessSpecs,
          witnessValues,
          constructorParams: ctorParams,
          constructorValues: ctorValues,
          requireWitnessValuesAtDeploy: ctorMeta.usesWitnesses,
          typeEnv,
          feeMode: deployFeeMode,
          onStage: (s) => setDeployStage(s),
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(makeLog("error", `Deploy failed: ${message}`, "network"));
      outcome = { success: false, duration: Date.now() - started, error: message };
    }

    setDeployResult(outcome);
    setStatus("idle");
    setDeployModalOpen(true);
    if (outcome.success) {
      addLog(
        makeLog(
          "success",
          "deployment.json updated with contract address. Open Contract to send a circuit.",
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
  const compileAllowed = entitlements?.compileAllowed !== false;
  const deployEnabled = !isRunning && !!activeProject && deployGate.canDeploy;
  const walletConnected = lace.status === "connected" && !!lace.connectedAPI;
  const walletLabel =
    lace.walletInfo?.unshieldedAddress
      ? `${lace.walletInfo.unshieldedAddress.slice(0, 6)}…${lace.walletInfo.unshieldedAddress.slice(-4)}`
      : "1AM";

  const handleWalletClick = async () => {
    if (walletConnected) {
      lace.disconnect();
      addLog(makeLog("info", "1AM disconnected.", "network"));
      return;
    }
    setLogTab("network");
    setBottomPanelOpen(true);
    addLog(makeLog("info", "Connecting to 1AM (only supported wallet)…", "network"));
    const api = await lace.connect();
    if (!api) {
      addLog(
        makeLog(
          "error",
          lace.error ??
            "1AM required. Install from https://1am.xyz/, unlock, select Preprod, approve this site.",
          "network",
        ),
      );
      return;
    }
    addLog(makeLog("success", "1AM connected.", "network"));
  };

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
    <>
    <header className="min-h-[3.75rem] h-[3.75rem] flex items-center gap-2 px-4 sm:px-5 bg-surface border-b border-border flex-shrink-0">
      <div className="flex items-center gap-2.5 mr-3 min-w-0">
        <a
          href="/playground"
          className="flex items-center flex-shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          aria-label="Compact Lab playground"
        >
          <CompactLabLogo height={26} className="h-[26px] w-auto max-w-[148px]" />
        </a>
        <span className="text-border-strong text-xl leading-none select-none opacity-70" aria-hidden>
          /
        </span>
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

      <div className="hidden md:flex items-center gap-2 mr-3">
        <span
          className="text-2xs uppercase tracking-wide px-2 py-1 rounded-md border border-border/80 text-text-muted bg-white/[0.02]"
          title="Midnight Preprod. Deploy and Call require the 1AM wallet only."
        >
          Preprod · 1AM
        </span>
        {SPONSORED_FEES_ENABLED && (
          <div
            className="flex items-center rounded-md border border-border/80 bg-white/[0.02] p-0.5"
            title={feeModeHelp(feeMode)}
            role="group"
            aria-label="Fee payment mode"
          >
            {(["sponsored", "self"] as FeeMode[]).map((mode) => {
              const active = feeMode === mode;
              const sponsoredUnavailable =
                mode === "sponsored" &&
                Boolean(sponsorStatus) &&
                (!sponsorStatus!.enabled ||
                  (!sponsorStatus!.healthy && !sponsorStatus!.syncing));
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={isRunning || (mode === "sponsored" && sponsoredUnavailable)}
                  onClick={() => {
                    if (mode === "sponsored" && sponsoredUnavailable) return;
                    setFeeMode(mode);
                    addLog(
                      makeLog(
                        "info",
                        `Fee mode set to ${feeModeLabel(mode)}. ${feeModeHelp(mode)}`,
                        "network",
                      ),
                    );
                  }}
                  className={cn(
                    "text-2xs px-2 py-1 rounded transition-colors",
                    active
                      ? "bg-accent/20 text-text-primary"
                      : "text-text-muted hover:text-text-primary",
                    sponsoredUnavailable && mode === "sponsored" && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {feeModeLabel(mode)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isRunning && (status === "compiling" || status === "saving") && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs mr-2">
          <StepBadge step={1} label="Compile" active={status === "compiling"} done={false} />
          <div className="w-4 h-px bg-border" />
          <StepBadge step={2} label="Prove" active={false} />
          <div className="w-4 h-px bg-border" />
          <StepBadge step={3} label="Submit" active={false} />
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

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          variant={walletConnected ? "ghost" : "default"}
          size="md"
          onClick={() => void handleWalletClick()}
          disabled={isRunning || lace.status === "connecting"}
          loading={lace.status === "connecting"}
          className={cn(
            "gap-1.5",
            walletConnected &&
              "border border-success/25 bg-success/[0.06] text-text-primary hover:bg-success/10",
          )}
          title={
            walletConnected
              ? "Disconnect 1AM"
              : "Connect 1AM wallet (required for Deploy and Call). Other wallets are not supported."
          }
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              walletConnected ? "bg-success" : "bg-text-muted",
            )}
          />
          {walletConnected ? walletLabel : "Connect 1AM"}
        </Button>

        <Button
          variant="default"
          size="md"
          onClick={() => void handleCompile(true)}
          loading={status === "compiling"}
          disabled={isRunning || !activeProject || !compileAllowed}
          className="gap-1.5"
          title={
            compileAllowed
              ? "Full Compact compile with ZK keys. Required before Deploy except unedited Hello/Counter."
              : "Server Compile is disabled on this host"
          }
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 2.5L10 6L2 9.5V2.5z" />
          </svg>
          Compile
        </Button>

        <Button
          variant="ghost"
          size="md"
          onClick={() => void handleCompile(false)}
          loading={status === "compiling"}
          disabled={isRunning || !activeProject || !compileAllowed}
          className="gap-1.5 hidden sm:inline-flex"
          title={
            compileAllowed
              ? "Typecheck only (--skip-zk). Does not prepare Deploy."
              : "Server Compile is disabled on this host"
          }
        >
          Typecheck
        </Button>

        <Divider vertical className="mx-0.5 h-5 self-center hidden sm:block" />

        <Button
          variant="accent"
          size="lg"
          onClick={() => void handleDeploy()}
          loading={status === "deploying"}
          disabled={!deployEnabled}
          className="gap-2 px-4 shadow-accent-glow"
          title={
            !activeProject
              ? "Create or open a project first"
              : deployGate.canDeploy
                ? `${deployGate.reason} Requires 1AM.`
                : deployGate.reason
          }
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v7M3 5l3-4 3 4M1 10h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Deploy
        </Button>

        <Button
          variant="ghost"
          size="md"
          onClick={() => void handleExport()}
          loading={exporting}
          disabled={!activeProject || exporting || isRunning}
          className="gap-1.5 hidden md:inline-flex"
          title="Download project as zip (source, deployment.json, and managed keys if present)"
        >
          Export
        </Button>

        <Divider vertical className="mx-1 h-5 self-center" />

        {user && (
          <ProfileMenu
            user={user}
            entitlements={entitlements}
            onUpgrade={BILLING_ENABLED ? () => void checkout().catch(() => {}) : undefined}
            onBilling={BILLING_ENABLED ? () => void portal().catch(() => {}) : undefined}
            onLogout={() => void logout()}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </div>
    </header>
    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    <SponsorFallbackModal
      open={Boolean(sponsorPrompt)}
      reason={sponsorPrompt?.reason ?? ""}
      syncing={Boolean(sponsorPrompt?.syncing)}
      onChoose={(choice) => {
        const resolve = sponsorPrompt?.resolve;
        setSponsorPrompt(null);
        resolve?.(choice);
      }}
    />
    <DeployConstructorModal
      open={Boolean(ctorPrompt)}
      params={ctorPrompt?.params ?? []}
      initialValues={ctorPrompt?.values ?? {}}
      typeEnv={
        ctorPrompt
          ? typeEnvFromCompactSource(
              getLiveCompactSource({
                files: activeProject?.files ?? [],
                activeFileId,
                code,
                tabBuffers,
              }),
            )
          : undefined
      }
      onCancel={() => {
        const resolve = ctorPrompt?.resolve;
        setCtorPrompt(null);
        resolve?.(null);
      }}
      onConfirm={(values) => {
        const resolve = ctorPrompt?.resolve;
        setCtorPrompt(null);
        resolve?.(values);
      }}
    />
    <DeployProgressModal
      open={deployModalOpen}
      running={status === "deploying"}
      stage={deployStage}
      startedAt={deployStartedAt}
      projectName={activeProject?.name ?? "Untitled"}
      result={deployResult}
      onClose={() => setDeployModalOpen(false)}
      onOpenContractUi={() => {
        setRightPanelTab("contract-ui");
        setDeployModalOpen(false);
      }}
      onViewLogs={() => {
        setLogTab("network");
        setBottomPanelOpen(true);
        setDeployModalOpen(false);
      }}
    />
    </>
  );
}

function initialsFor(user: UserPublic): string {
  const base = (user.name || user.email || "?").trim();
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function ProfileMenu({
  user,
  entitlements,
  onUpgrade,
  onBilling,
  onLogout,
  onOpenSettings,
}: {
  user: UserPublic;
  entitlements: Entitlements | null;
  onUpgrade?: () => void;
  onBilling?: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const planLabel = BILLING_ENABLED
    ? entitlements?.planSlug === "paid"
      ? "Pro"
      : "Free"
    : "Community";
  const displayName = user.name?.trim() || user.email.split("@")[0] || "Account";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full pl-0.5 pr-2 py-0.5",
          "border border-border/80 bg-white/[0.03] hover:bg-white/[0.06]",
          "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        title={user.email}
      >
        <span className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
          {user.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/80 to-accent/40 text-[11px] font-semibold text-white tracking-wide">
              {initialsFor(user)}
            </span>
          )}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight min-w-0 pr-0.5">
          <span className="text-xs text-text-primary font-medium truncate max-w-[120px]">
            {displayName}
          </span>
          <span className="text-2xs text-text-muted">{planLabel}</span>
        </span>
        <svg
          className={cn("w-3 h-3 text-text-muted transition-transform", open && "rotate-180")}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-border bg-surface-2 shadow-xl overflow-hidden"
        >
          <div className="px-3.5 py-3 border-b border-border flex items-center gap-3">
            <span className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/80 to-accent/40 text-xs font-semibold text-white">
                  {initialsFor(user)}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-text-primary font-medium truncate">{displayName}</p>
              <p className="text-2xs text-text-muted truncate">{user.email}</p>
            </div>
          </div>

          <div className="px-2 py-2 space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1.5 text-xs text-text-muted">
              <span>Plan</span>
              <span className="text-text-secondary font-medium">{planLabel}</span>
            </div>
            {BILLING_ENABLED && entitlements?.planSlug !== "paid" && onUpgrade && (
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-2 py-2 rounded-md text-sm text-text-primary hover:bg-white/6 transition-colors"
                onClick={() => {
                  setOpen(false);
                  onUpgrade();
                }}
              >
                Upgrade to Pro
              </button>
            )}
            {BILLING_ENABLED && entitlements?.planSlug === "paid" && onBilling && (
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-2 py-2 rounded-md text-sm text-text-primary hover:bg-white/6 transition-colors"
                onClick={() => {
                  setOpen(false);
                  onBilling();
                }}
              >
                Manage billing
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-2 py-2 rounded-md text-sm text-text-primary hover:bg-white/6 transition-colors"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-2 py-2 rounded-md text-sm text-text-muted hover:text-text-primary hover:bg-white/6 transition-colors"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
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
