"use client";

import { useRef, useEffect, useCallback } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useIDEStore } from "@/store/ide";
import { compileCompact, makeLog } from "@/lib/compact";
import { registerCompactLanguage } from "./compact-language";
import { EditorTabBar } from "./EditorTabBar";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function CompactEditor() {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const {
    code,
    setCode,
    saveProject,
    activeFile,
    status,
    addLog,
    setCompileResult,
    setStatus,
    setLogTab,
    setBottomPanelOpen,
    clearLogs,
    upsertGeneratedFiles,
  } = useIDEStore();

  const handleBeforeMount: BeforeMount = (monaco) => {
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
          "Updated pragma to language version >= 0.22 (compiler package +0.30.0 implements language 0.22.0).",
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
    } else {
      const errorCount = result.errors?.length ?? 0;
      addLog(makeLog("error", `Compilation failed: ${errorCount} error${errorCount !== 1 ? "s" : ""}`, "compiler"));
      result.errors?.forEach((e) => {
        addLog(makeLog("error", `Line ${e.line}, Col ${e.column}: ${e.message}`, "compiler"));
      });
      if (result.installHint) {
        addLog(makeLog("info", result.installHint, "compiler"));
      }
    }

    setCompileResult(result);
    setStatus("idle");
  }, [
    clearLogs,
    setLogTab,
    setBottomPanelOpen,
    setCompileResult,
    setStatus,
    addLog,
    upsertGeneratedFiles,
    setCode,
  ]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        saveProject();
      },
    );

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      () => {
        void runCompile();
      },
    );

    editor.focus();
  };

  const handleChange = useCallback(
    (value: string | undefined) => {
      const newCode = value ?? "";
      setCode(newCode);

      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveProject();
      }, 2000);
    },
    [setCode, saveProject],
  );

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "#111111" }}>
      <EditorTabBar />

      <div className="flex-1 overflow-hidden relative">
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
            <div className="flex items-center justify-center h-full" style={{ background: "#111111" }}>
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
            fontSize: 13,
            fontLigatures: true,
            lineHeight: 22,
            tabSize: 2,
            minimap: { enabled: false },
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 4,
              horizontalScrollbarSize: 4,
            },
            lineNumbers: "on",
            glyphMargin: false,
            folding: true,
            foldingHighlight: false,
            renderLineHighlight: "all",
            cursorStyle: "line",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            wordWrap: "on",
            padding: { top: 20, bottom: 20 },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            bracketPairColorization: { enabled: false },
            guides: {
              bracketPairs: false,
              indentation: true,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            stickyScroll: { enabled: false },
            formatOnPaste: true,
            contextmenu: false,
          }}
        />
      </div>
      {/* Keep deps for compile shortcut */}
    </div>
  );
}
