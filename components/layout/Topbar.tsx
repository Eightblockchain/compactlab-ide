"use client";

import { useIDEStore } from "@/store/ide";
import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  useLaceWallet,
  isWalletSessionExpiredMessage,
  WALLET_SESSION_EXPIRED_MSG,
} from "@/hooks/useLaceWallet";
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
import { onOpenSettingsRequest, useActiveNetwork } from "@/lib/user-settings";
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
    setHelpOpen,
    upsertGeneratedFiles,
    setCode,
    witnessValues,
    constructorValues,
    setConstructorValues,
    setWitnessValues,
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
  useEffect(() => onOpenSettingsRequest(() => setSettingsOpen(true)), []);
  const network = useActiveNetwork();
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
    witnesses: Array<{ name: string; type: string }>;
    witnessValues: Record<string, string>;
    constructorWitnessNames: string[];
    resolve: (
      result: {
        constructorValues: Record<string, string>;
        witnessValues: Record<string, string>;
      } | null,
    ) => void;
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
        network: `Midnight ${network.label}`,
      });
    } else if (lace.status === "disconnected" || lace.status === "error") {
      setWalletState({
        connected: false,
        address: null,
        balance: null,
        dustCap: null,
        network: `Midnight ${network.label}`,
      });
    }
  }, [lace.status, lace.walletInfo, lace.dustBalance, setWalletState, network.label]);

  useEffect(() => {
    if (lace.status === "error" && lace.error) {
      const expired = isWalletSessionExpiredMessage(lace.error);
      addLog(
        makeLog(
          expired ? "warn" : "error",
          expired ? lace.error : `Wallet: ${lace.error}`,
          "network",
        ),
      );
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

    const { witnessSpecsForNames, validateWitnessValues } = await import(
      "@/lib/playground-witnesses"
    );
    // Only witnesses the constructor body calls are required at Deploy.
    // Other declared witnesses run later when their circuits are Called.
    const deployWitnessSpecs = witnessSpecsForNames(
      witnessSpecs,
      ctorMeta.witnessNamesUsed,
    );

    let ctorValues = { ...useIDEStore.getState().constructorValues };
    let deployWitnessValues = { ...useIDEStore.getState().witnessValues };

    const needsSetup = ctorParams.length > 0 || deployWitnessSpecs.length > 0;

    if (needsSetup) {
      const filled = await new Promise<{
        constructorValues: Record<string, string>;
        witnessValues: Record<string, string>;
      } | null>((resolve) => {
        setCtorPrompt({
          params: ctorParams,
          values: ctorValues,
          witnesses: deployWitnessSpecs,
          witnessValues: deployWitnessValues,
          constructorWitnessNames: ctorMeta.witnessNamesUsed,
          resolve,
        });
      });
      if (!filled) {
        addLog(
          makeLog(
            "info",
            "Deploy cancelled: required Deploy inputs were not provided.",
            "network",
          ),
        );
        return;
      }
      ctorValues = filled.constructorValues;
      deployWitnessValues = filled.witnessValues;
      setConstructorValues(filled.constructorValues);
      if (deployWitnessSpecs.length > 0) {
        setWitnessValues({
          ...useIDEStore.getState().witnessValues,
          ...filled.witnessValues,
        });
      }
      if (ctorParams.length > 0) {
        addLog(
          makeLog(
            "info",
            `Constructor args: ${ctorParams.map((p) => `${p.name}=${filled.constructorValues[p.name] ?? ""}`).join(", ")}`,
            "network",
          ),
        );
      }
      if (deployWitnessSpecs.length > 0) {
        addLog(
          makeLog(
            "info",
            `Private witnesses ready for Deploy: ${deployWitnessSpecs.map((w) => w.name).join(", ")}`,
            "network",
          ),
        );
      }
    }

    // Final gate — should already pass after the setup modal.
    const ctorErr = validateCompactParams(
      ctorParams,
      ctorValues,
      "Constructor parameter",
      typeEnv,
    );
    if (ctorErr) {
      addLog(makeLog("error", ctorErr, "network"));
      return;
    }
    if (deployWitnessSpecs.length > 0) {
      const wErr = validateWitnessValues(deployWitnessSpecs, deployWitnessValues);
      if (wErr) {
        addLog(makeLog("error", wErr, "network"));
        setRightPanelTab("contract-ui");
        return;
      }
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
          "Deploying bundled ZK assets for Hello/Counter (source matches template). You can Compile first if you want your own keys.",
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

    setDeployStage("connect");
    let connectedAPI = lace.connectedAPI;
    if (connectedAPI) {
      connectedAPI = await lace.ensureSession();
      if (!connectedAPI) {
        addLog(
          makeLog(
            "warn",
            "1AM session expired. Reconnect, then Deploy again — your setup inputs are unchanged.",
            "network",
          ),
        );
        setDeployModalOpen(false);
        setStatus("idle");
        return;
      }
    } else {
      addLog(makeLog("info", "Connecting to 1AM wallet…", "network"));
      connectedAPI = await lace.connect();
      if (!connectedAPI) {
        failDeploy(
          lace.error ??
            `Could not connect. CompactLab only supports 1AM (https://1am.xyz/). Install it, unlock it, set ${network.label}, approve this site, then retry.`,
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

    // CompactLab's fee sponsor runs on Preprod only.
    let deployFeeMode = SPONSORED_FEES_ENABLED && network.sponsorship ? feeMode : "self";
    if (deployFeeMode === "self" && userDustEmpty) {
      failDeploy(
        `Your tDUST balance is 0. Fund tNIGHT at ${network.faucetUrl} , wait for Dust generation, then retry Deploy.`,
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

    const ctorErrLate = validateCompactParams(
      ctorParams,
      ctorValues,
      "Constructor parameter",
      typeEnv,
    );
    if (ctorErrLate) {
      failDeploy(ctorErrLate);
      return;
    }
    if (deployWitnessSpecs.length > 0) {
      const wErr = validateWitnessValues(deployWitnessSpecs, deployWitnessValues);
      if (wErr) {
        failDeploy(wErr);
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
          witnessValues: deployWitnessValues,
          constructorParams: ctorParams,
          constructorValues: ctorValues,
          requireWitnessValuesAtDeploy: ctorMeta.usesWitnesses,
          requiredWitnessNamesAtDeploy: ctorMeta.witnessNamesUsed,
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

    if (
      !outcome.success &&
      outcome.error &&
      isWalletSessionExpiredMessage(outcome.error)
    ) {
      lace.markSessionExpired(WALLET_SESSION_EXPIRED_MSG);
      outcome = {
        ...outcome,
        error: "1AM connection expired. Reconnect, then click Deploy again.",
      };
      addLog(
        makeLog(
          "warn",
          "Deploy paused: 1AM session expired. Reconnect from the toolbar, then Deploy again.",
          "network",
        ),
      );
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
  const needsReconnect =
    !walletConnected &&
    !!lace.error &&
    isWalletSessionExpiredMessage(lace.error);
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
    addLog(
      makeLog(
        "info",
        needsReconnect
          ? "Reconnecting to 1AM…"
          : "Connecting to 1AM (only supported wallet)…",
        "network",
      ),
    );
    const api = await lace.connect();
    if (!api) {
      addLog(
        makeLog(
          "error",
          lace.error ??
            `1AM required. Install from https://1am.xyz/, unlock, select ${network.label}, approve this site.`,
          "network",
        ),
      );
      return;
    }
    addLog(makeLog("success", needsReconnect ? "1AM reconnected." : "1AM connected.", "network"));
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
    <header className="h-11 flex items-center gap-3 pl-3.5 pr-2.5 bg-background border-b border-border flex-shrink-0">
      <a
        href="/playground"
        className="flex items-center flex-shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label="Compact Lab playground"
      >
        <CompactLabLogo height={18} className="h-[18px] w-auto max-w-[120px]" />
      </a>

      <span className="h-4 w-px bg-border-strong flex-shrink-0" aria-hidden />

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
            className="bg-white/[0.04] border border-border-strong rounded-md px-2 h-7 text-sm text-text-primary focus:outline-none focus:border-accent/60 w-48"
            autoFocus
          />
        ) : (
          <button
            onClick={startRename}
            className="text-sm text-text-primary font-medium truncate max-w-56 hover:bg-white/[0.05] rounded-md px-1.5 h-7 transition-colors"
            title="Rename project"
          >
            {activeProject?.name ?? "Untitled"}
          </button>
        )}
        <SaveIndicator status={saveStatus} />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <Button
          variant="default"
          size="md"
          onClick={() => void handleWalletClick()}
          disabled={isRunning || lace.status === "connecting"}
          loading={lace.status === "connecting"}
          className={cn(
            "gap-2",
            needsReconnect && "border-warning/40 bg-warning/[0.08] hover:bg-warning/15",
          )}
          title={
            walletConnected
              ? "Disconnect 1AM"
              : needsReconnect
                ? lace.error ?? WALLET_SESSION_EXPIRED_MSG
                : "Connect the 1AM wallet. Deploy and Call need it; other wallets are not supported."
          }
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              walletConnected ? "bg-success" : needsReconnect ? "bg-warning" : "bg-text-muted",
            )}
          />
          {walletConnected ? (
            <span className="font-mono text-xs">{walletLabel}</span>
          ) : needsReconnect ? (
            "Reconnect 1AM"
          ) : (
            "Connect 1AM"
          )}
        </Button>

        <div className="flex items-center">
          <Button
            variant="default"
            size="md"
            onClick={() => void handleCompile(true)}
            loading={status === "compiling"}
            disabled={isRunning || !activeProject || !compileAllowed}
            className="rounded-r-none border-r-0 gap-1.5"
            title={
              compileAllowed
                ? "Full compile with ZK keys (⌘↵). Required before Deploy, except unedited Hello World and Counter."
                : "Server Compile is disabled on this host"
            }
          >
            Compile
          </Button>
          <Menu
            width={248}
            trigger={({ open, toggle }) => (
              <Button
                variant="default"
                size="md"
                onClick={toggle}
                disabled={isRunning || !activeProject || !compileAllowed}
                className={cn("rounded-l-none px-1.5", open && "bg-white/[0.08]")}
                aria-label="More compile options"
                aria-expanded={open}
              >
                <Chevron />
              </Button>
            )}
          >
            <MenuItem onSelect={() => void handleCompile(true)} hint="⌘↵">
              Compile with ZK keys
            </MenuItem>
            <MenuItem onSelect={() => void handleCompile(false)}>
              Typecheck only
            </MenuItem>
            <p className="px-2 pb-1.5 pt-0.5 text-2xs text-text-muted leading-relaxed">
              Typecheck skips proving keys and does not prepare Deploy.
            </p>
          </Menu>
        </div>

        <Button
          variant="accent"
          size="md"
          onClick={() => void handleDeploy()}
          loading={status === "deploying"}
          disabled={!deployEnabled}
          className="px-3.5"
          title={
            !activeProject
              ? "Create or open a project first"
              : deployGate.canDeploy
                ? `${deployGate.reason} Requires 1AM.`
                : deployGate.reason
          }
        >
          Deploy
        </Button>

        <span className="mx-1 h-4 w-px bg-border flex-shrink-0" aria-hidden />

        <IconButton
          size="md"
          onClick={() => setHelpOpen(true)}
          title="Learn Compact"
          aria-label="Learn Compact"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="8" cy="8" r="6.25" />
            <path d="M6.3 6.2a1.75 1.75 0 1 1 2.5 1.6c-.5.25-.8.6-.8 1.1v.35" strokeLinecap="round" />
            <circle cx="8" cy="11.4" r="0.6" fill="currentColor" stroke="none" />
          </svg>
        </IconButton>

        <Menu
          width={240}
          trigger={({ open, toggle }) => (
            <IconButton
              size="md"
              onClick={toggle}
              active={open}
              title="More actions"
              aria-label="More actions"
              aria-expanded={open}
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                <circle cx="3.5" cy="8" r="1.1" />
                <circle cx="8" cy="8" r="1.1" />
                <circle cx="12.5" cy="8" r="1.1" />
              </svg>
            </IconButton>
          )}
        >
          <MenuItem
            onSelect={() => void handleExport()}
            disabled={!activeProject || exporting || isRunning}
          >
            {exporting ? "Exporting…" : "Export project (.zip)"}
          </MenuItem>
          {SPONSORED_FEES_ENABLED && network.sponsorship && (
            <>
              <MenuSeparator />
              <MenuLabel>Network fees</MenuLabel>
              {(["sponsored", "self"] as FeeMode[]).map((mode) => {
                const sponsoredUnavailable =
                  mode === "sponsored" &&
                  Boolean(sponsorStatus) &&
                  (!sponsorStatus!.enabled ||
                    (!sponsorStatus!.healthy && !sponsorStatus!.syncing));
                return (
                  <MenuItem
                    key={mode}
                    checked={feeMode === mode}
                    disabled={isRunning || sponsoredUnavailable}
                    onSelect={() => {
                      setFeeMode(mode);
                      addLog(
                        makeLog(
                          "info",
                          `Fee mode set to ${feeModeLabel(mode)}. ${feeModeHelp(mode)}`,
                          "network",
                        ),
                      );
                    }}
                  >
                    {feeModeLabel(mode)}
                  </MenuItem>
                );
              })}
            </>
          )}
        </Menu>

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
      constructorParams={ctorPrompt?.params ?? []}
      initialConstructorValues={ctorPrompt?.values ?? {}}
      witnessParams={ctorPrompt?.witnesses ?? []}
      initialWitnessValues={ctorPrompt?.witnessValues ?? {}}
      constructorWitnessNames={ctorPrompt?.constructorWitnessNames ?? []}
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
      onConfirm={(result) => {
        const resolve = ctorPrompt?.resolve;
        setCtorPrompt(null);
        resolve?.(result);
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
  const planLabel = BILLING_ENABLED
    ? entitlements?.planSlug === "paid"
      ? "Pro"
      : "Free"
    : "Community";
  const displayName = user.name?.trim() || user.email.split("@")[0] || "Account";

  return (
    <Menu
      width={248}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "ml-0.5 rounded-full transition-shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60",
            open ? "ring-1 ring-border-strong" : "hover:ring-1 hover:ring-border-strong",
          )}
          aria-expanded={open}
          aria-haspopup="menu"
          title={user.email}
        >
          <Avatar user={user} size={26} />
        </button>
      )}
    >
      <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2.5">
        <Avatar user={user} size={32} />
        <div className="min-w-0">
          <p className="text-sm text-text-primary font-medium truncate">{displayName}</p>
          <p className="text-2xs text-text-muted truncate">{user.email}</p>
        </div>
        <span className="ml-auto text-[10px] font-medium text-text-secondary border border-border rounded px-1.5 py-0.5">
          {planLabel}
        </span>
      </div>
      <MenuSeparator />
      {BILLING_ENABLED && entitlements?.planSlug !== "paid" && onUpgrade && (
        <MenuItem onSelect={onUpgrade}>Upgrade to Pro</MenuItem>
      )}
      {BILLING_ENABLED && entitlements?.planSlug === "paid" && onBilling && (
        <MenuItem onSelect={onBilling}>Manage billing</MenuItem>
      )}
      <MenuItem onSelect={onOpenSettings}>Settings</MenuItem>
      <MenuItem onSelect={onLogout} tone="muted">
        Log out
      </MenuItem>
    </Menu>
  );
}

function Avatar({ user, size }: { user: UserPublic; size: number }) {
  return (
    <span
      className="relative rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10 block"
      style={{ width: size, height: size }}
    >
      {user.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="w-full h-full flex items-center justify-center bg-surface-2 text-[10px] font-semibold text-text-secondary tracking-wide">
          {initialsFor(user)}
        </span>
      )}
    </span>
  );
}

function SaveIndicator({ status }: { status: string }) {
  if (status === "saving") {
    return <span className="text-2xs text-text-muted whitespace-nowrap">Saving…</span>;
  }
  if (status === "unsaved") {
    return (
      <span className="flex items-center gap-1 text-2xs text-warning whitespace-nowrap">
        <span className="w-1 h-1 rounded-full bg-warning" aria-hidden />
        Unsaved
      </span>
    );
  }
  if (status === "saved") {
    return <span className="text-2xs text-text-dim whitespace-nowrap">Saved</span>;
  }
  return null;
}

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
