"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useIDEStore } from "@/store/ide";
import { useUserSettings } from "@/lib/user-settings";
import { compileCompact, makeLog } from "@/lib/compact";
import { applyDiagnosticsToModel } from "@/lib/compact-diagnostics";
import { compactEditorBridge } from "@/lib/compact-editor-bridge";
import { analyzePrivacy, type PrivacyKind } from "@/lib/compact-privacy";
import { explainTypesFromMessages } from "@/lib/compact-symbols";
import { registerCompactLanguage } from "./compact-language";
import { EditorTabBar } from "./EditorTabBar";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let typecheckTimeout: ReturnType<typeof setTimeout> | null = null;
let typecheckGeneration = 0;

const TYPECHECK_DEBOUNCE_MS = 1500;
/** Log source for silent typecheck explanations — cleared when the file typechecks clean. */
const TYPECHECK_LOG_SOURCE = "typecheck";

export function CompactEditor() {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const privacyDecosRef = useRef<string[]>([]);
  const lastTypecheckErrorsRef = useRef<{ code: string; errors: NonNullable<import("@/lib/compact").CompileResult["errors"]> } | null>(null);

  const [typecheckStatus, setTypecheckStatus] = useState<"idle" | "checking">("idle");
  const editorFontSize = useUserSettings((s) => s.editorFontSize);
  const editorTabSize = useUserSettings((s) => s.editorTabSize);

  const {
    code,
    setCode,
    saveProject,
    activeFile,
    status,
    compileResult,
    addLog,
    clearLogsBySource,
    setCompileResult,
    setStatus,
    setLogTab,
    setBottomPanelOpen,
    clearLogs,
    upsertGeneratedFiles,
    activeProject,
    rightPanelTab,
  } = useIDEStore();

  const isCompactFile = (activeFile?.language ?? "compact") === "compact";

  const refreshMarkers = useCallback(
    (sourceCode: string, serverErrors?: import("@/lib/compact").CompileError[]) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco || !isCompactFile) return;
      const model = editor.getModel();
      applyDiagnosticsToModel(monaco, model, sourceCode, serverErrors);
    },
    [isCompactFile],
  );

  const runSilentTypecheck = useCallback(
    async (sourceCode: string, generation: number) => {
      if (!isCompactFile) return;

      setTypecheckStatus("checking");
      const result = await compileCompact(sourceCode, {
        projectId: activeProject?.id,
        zk: false,
      });

      if (generation !== typecheckGeneration) return;

      lastTypecheckErrorsRef.current = {
        code: sourceCode,
        errors: result.errors ?? [],
      };

      if (!result.success && result.errors?.length) {
        refreshMarkers(sourceCode, result.errors);
        // Replace prior typecheck explanations so Logs stay current.
        clearLogsBySource(TYPECHECK_LOG_SOURCE);
        const messages = result.errors.map((e) => e.message);
        const explanations = explainTypesFromMessages(sourceCode, messages);
        if (explanations.length > 0) {
          addLog(
            makeLog(
              "info",
              `Type hints (${result.errors.length} issue${result.errors.length === 1 ? "" : "s"}):`,
              TYPECHECK_LOG_SOURCE,
            ),
          );
          for (const line of explanations) {
            addLog(makeLog("info", line, TYPECHECK_LOG_SOURCE));
          }
        }
      } else if (result.success) {
        refreshMarkers(sourceCode, []);
        clearLogsBySource(TYPECHECK_LOG_SOURCE);
      }

      setTypecheckStatus("idle");
    },
    [activeProject?.id, addLog, clearLogsBySource, isCompactFile, refreshMarkers],
  );

  const scheduleTypecheck = useCallback(
    (sourceCode: string) => {
      if (!isCompactFile) return;
      if (typecheckTimeout) clearTimeout(typecheckTimeout);
      typecheckGeneration += 1;
      const gen = typecheckGeneration;

      refreshMarkers(sourceCode, lastTypecheckErrorsRef.current?.code === sourceCode
        ? lastTypecheckErrorsRef.current.errors
        : undefined);

      typecheckTimeout = setTimeout(() => {
        if (useIDEStore.getState().status !== "idle") return;
        void runSilentTypecheck(sourceCode, gen);
      }, TYPECHECK_DEBOUNCE_MS);
    },
    [isCompactFile, refreshMarkers, runSilentTypecheck],
  );

  useEffect(() => {
    if (!isCompactFile) return;
    const serverErrors =
      compileResult && !compileResult.success
        ? compileResult.errors
        : compileResult?.success
          ? []
          : lastTypecheckErrorsRef.current?.code === code
            ? lastTypecheckErrorsRef.current.errors
            : undefined;
    refreshMarkers(code, serverErrors);
  }, [compileResult, code, isCompactFile, refreshMarkers]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !isCompactFile) return;
    const model = editor.getModel();
    if (!model) return;

    if (rightPanelTab !== "privacy") {
      privacyDecosRef.current = editor.deltaDecorations(privacyDecosRef.current, []);
      return;
    }

    const CLASS: Record<PrivacyKind, string> = {
      private: "compact-privacy-private",
      public: "compact-privacy-public",
      disclose: "compact-privacy-disclose",
      hash: "compact-privacy-hash",
    };
    const seen = new Set<string>();
    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
    for (const span of analyzePrivacy(code).spans) {
      const key = `${span.kind}:${span.line}:${span.column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      decorations.push({
        range: new monaco.Range(span.line, span.column, span.line, span.endColumn),
        options: {
          inlineClassName: CLASS[span.kind],
          hoverMessage: { value: span.note },
        },
      });
    }
    privacyDecosRef.current = editor.deltaDecorations(privacyDecosRef.current, decorations);
  }, [code, isCompactFile, rightPanelTab]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    registerCompactLanguage(monaco);
  };

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (
        reason &&
        (reason.type === "cancelation" ||
          reason.name === "Canceled" ||
          reason.message === "Canceled" ||
          (typeof reason.msg === "string" && reason.msg.includes("canceled")))
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  const runCompile = useCallback(async () => {
    const state = useIDEStore.getState();
    if (state.status !== "idle") return;

    clearLogs();
    setLogTab("compile");
    setBottomPanelOpen(true);
    setCompileResult(null);
    setStatus("compiling");

    let compileCode = state.code;
    if (state.activeFile?.language !== "compact") {
      const compactFile = state.activeProject?.files.find((f) => f.language === "compact");
      if (!compactFile) {
        addLog(makeLog("error", "No Compact contract file (.compact) found in this project.", "compiler"));
        setStatus("idle");
        return;
      }
      addLog(makeLog("warn", `Compiling ${compactFile.name} (not the currently open file)`, "compiler"));
      compileCode = compactFile.content;
    }

    addLog(makeLog("info", "Starting compilation…", "compiler"));

    const result = await compileCompact(compileCode, {
      projectId: state.activeProject?.id,
      zk: true,
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
      addLog(makeLog("success", `Full compile OK${versionTag}: ${circuitCount} circuit(s) in ${result.duration}ms`, "compiler"));
      if (result.stdoutHint) addLog(makeLog("info", result.stdoutHint, "compiler"));
      if (result.artifacts) {
        addLog(makeLog("info", `keys/[${result.artifacts.keys.join(", ") || "NONE"}]`, "compiler"));
      }
      result.warnings?.forEach((w) => addLog(makeLog("warn", w, "compiler")));
      if (result.artifactBaseUrl) {
        addLog(makeLog("success", `Persisted at ${result.artifactBaseUrl}`, "compiler"));
      }
      if (result.generatedFiles && result.generatedFiles.length > 0) {
        upsertGeneratedFiles(result.generatedFiles);
      }
      lastTypecheckErrorsRef.current = { code: compileCode, errors: [] };
      clearLogsBySource(TYPECHECK_LOG_SOURCE);
    } else {
      const errorCount = result.errors?.length ?? 0;
      addLog(makeLog("error", `Compilation failed: ${errorCount} error${errorCount !== 1 ? "s" : ""}`, "compiler"));
      result.errors?.forEach((e) => {
        addLog(makeLog("error", `Line ${e.line}, Col ${e.column}: ${e.message}`, "compiler"));
      });
      if (result.installHint) {
        addLog(makeLog("info", result.installHint, "compiler"));
      }
      lastTypecheckErrorsRef.current = { code: compileCode, errors: result.errors ?? [] };
      const explanations = explainTypesFromMessages(
        compileCode,
        (result.errors ?? []).map((e) => e.message),
      );
      clearLogsBySource(TYPECHECK_LOG_SOURCE);
      for (const line of explanations) {
        addLog(makeLog("info", line, TYPECHECK_LOG_SOURCE));
      }
    }

    setCompileResult(result);
    setStatus("idle");
    refreshMarkers(compileCode, result.errors);
  }, [
    clearLogs,
    clearLogsBySource,
    setLogTab,
    setBottomPanelOpen,
    setCompileResult,
    setStatus,
    addLog,
    upsertGeneratedFiles,
    setCode,
    refreshMarkers,
  ]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    compactEditorBridge.register(editor, monacoInstance);

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      saveProject();
    });

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      void runCompile();
    });

    refreshMarkers(code);
    editor.focus();
  };

  useEffect(() => {
    return () => {
      if (editorRef.current) {
        compactEditorBridge.unregister(editorRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      const newCode = value ?? "";
      setCode(newCode);
      scheduleTypecheck(newCode);

      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveProject();
      }, 2000);
    },
    [setCode, saveProject, scheduleTypecheck],
  );

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "#0c0c0e" }}>
      <EditorTabBar />

      <div className="flex-1 overflow-hidden relative">
        {/* Non-layout status: never changes editor height while typing */}
        {isCompactFile && typecheckStatus === "checking" && status === "idle" && (
          <div
            className="pointer-events-none absolute top-2 right-3 z-20 text-2xs font-mono tracking-wide"
            style={{ color: "#5c5c58" }}
            aria-live="polite"
          >
            Checking…
          </div>
        )}

        {status === "compiling" || status === "deploying" ? (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="h-0.5 bg-accent/20">
              <div
                className="h-full bg-accent animate-[progressBar_2s_ease-in-out_infinite]"
                style={{ width: "60%" }}
              />
            </div>
          </div>
        ) : null}

        <Editor
          height="100%"
          language={activeFile?.language ?? "compact"}
          theme={activeFile?.language === "compact" ? "compactlab-dark" : "vs-dark"}
          value={code}
          beforeMount={handleBeforeMount}
          onChange={handleChange}
          onMount={handleEditorMount}
          loading={
            <div className="flex items-center justify-center h-full" style={{ background: "#0c0c0e" }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: "#636360" }}>
                <div
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: "#F06358", borderTopColor: "transparent" }}
                />
                Loading editor…
              </div>
            </div>
          }
          options={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: editorFontSize,
            fontLigatures: true,
            lineHeight: Math.round(editorFontSize * 1.55),
            tabSize: editorTabSize,
            minimap: { enabled: false },
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 4,
              horizontalScrollbarSize: 4,
            },
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            lineDecorationsWidth: 10,
            glyphMargin: true,
            folding: true,
            foldingHighlight: false,
            renderLineHighlight: "all",
            cursorStyle: "line",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            wordWrap: "on",
            // Extra bottom pad so the caret near the panel still has room; widgets
            // use fixedOverflowWidgets so suggestions are not clipped by panels.
            padding: { top: 12, bottom: 72 },
            fixedOverflowWidgets: true,
            suggest: {
              showKeywords: true,
              showSnippets: true,
              insertMode: "replace",
              preview: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            suggestFontSize: editorFontSize,
            suggestLineHeight: Math.round(editorFontSize * 1.55),
            bracketPairColorization: { enabled: false },
            guides: {
              bracketPairs: false,
              indentation: true,
            },
            overviewRulerLanes: 3,
            hideCursorInOverviewRuler: false,
            stickyScroll: { enabled: false },
            formatOnPaste: true,
            contextmenu: true,
          }}
        />
      </div>
    </div>
  );
}
