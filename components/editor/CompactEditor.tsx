"use client";

import { useRef, useEffect, useCallback } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useIDEStore } from "@/store/ide";
import { mockCompile } from "@/lib/compact";
import { registerCompactLanguage } from "./compact-language";

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
  } = useIDEStore();

  // beforeMount fires BEFORE the editor instance is created — this is the only
  // correct place to call defineTheme() so the theme exists when the editor
  // first renders. Using useEffect + useMonaco() causes a race: the editor
  // tries to resolve the theme name before defineTheme() has been called.
  const handleBeforeMount: BeforeMount = (monaco) => {
    registerCompactLanguage(monaco);
  };

  // Suppress benign Monaco CancellationErrors (async ops cancelled on model change)
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

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Keyboard shortcuts
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        saveProject();
      }
    );

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      async () => {
        const state = useIDEStore.getState();
        if (state.status !== "idle") return;
        clearLogs();
        setLogTab("compile");
        setBottomPanelOpen(true);
        setStatus("compiling");
        const result = await mockCompile(state.code, addLog);
        setCompileResult(result);
        setStatus("idle");
      }
    );

    // Focus editor
    editor.focus();
  };

  const handleChange = useCallback((value: string | undefined) => {
    const newCode = value ?? "";
    setCode(newCode);

    // Debounced auto-save
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveProject();
    }, 2000);
  }, [setCode, saveProject]);

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "#111111" }}>
      {/* Tab bar — shell chrome (darker) frames the editor below */}
      <div
        className="flex items-center flex-shrink-0 border-b border-border"
        style={{ background: "#0d0d0d", minHeight: 35 }}
      >
        {/* Active file tab — floats up to editor bg level */}
        <div
          className="flex items-center gap-2 px-4 h-full border-r border-border"
          style={{
            background: "#111111",
            borderTop: "2px solid #F06358",
            paddingTop: 2,
            paddingBottom: 0,
          }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 12 12" fill="none" stroke="#E8AA5B" strokeWidth="1.2">
            <path d="M7 1H3a1 1 0 00-1 1v8a1 1 0 001 1h6a1 1 0 001-1V4L7 1z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 1v3h3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-medium" style={{ color: "#eeeeee" }}>contract.compact</span>
        </div>

        <div className="flex-1" />

        {/* Status hints */}
        <div className="flex items-center gap-3 px-4 text-2xs font-mono" style={{ color: "#636360" }}>
          <span>Compact v0.14</span>
          <span style={{ color: "#3d3d3a" }}>│</span>
          <span>Midnight Devnet</span>
          <span style={{ color: "#3d3d3a" }}>│</span>
          <span><kbd className="font-sans">⌘S</kbd> Save</span>
          <span><kbd className="font-sans">⌘↵</kbd> Run</span>
        </div>
      </div>

      {/* Monaco editor */}
      <div className="flex-1 overflow-hidden">
        {status === "compiling" || status === "deploying" ? (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="h-0.5 bg-accent/20">
              <div className="h-full bg-accent animate-[progressBar_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
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
                <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#F06358", borderTopColor: "transparent" }} />
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
            bracketPairColorization: { enabled: false },   // prevent blue bracket leak from vs-dark base
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
    </div>
  );
}
