"use client";

import { useEffect, useState } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { useIDEStore } from "@/store/ide";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { CompactEditor } from "@/components/editor/CompactEditor";
import { InspectorPanel } from "@/components/panels/InspectorPanel";
import { BottomPanel } from "@/components/panels/BottomPanel";
import { NewProjectModal } from "@/components/modals/NewProjectModal";

export default function PlaygroundPage() {
  const { activeProjectId, projects, loadProject, sidebarOpen, bottomPanelOpen } = useIDEStore();
  // Guard against Zustand persist hydration mismatch (localStorage vs SSR)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!activeProjectId && projects.length > 0) {
      loadProject(projects[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0d0d0d",
          color: "#636360",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
          gap: "10px",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "2px solid #E95144",
            borderTopColor: "transparent",
            animation: "spin 0.7s linear infinite",
          }}
        />
        Loading CompactLab…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      {/* Fixed topbar */}
      <Topbar />

      {/* Main IDE body — flex-1 + min-h-0 are critical for nested panels */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PanelGroup orientation="horizontal" id="compactlab-h" style={{ height: "100%" }}>
          {/* Sidebar */}
          {sidebarOpen && (
            <>
              <Panel id="sidebar" defaultSize="14%" minSize="10%" maxSize="25%">
                <div className="h-full overflow-hidden">
                  <Sidebar />
                </div>
              </Panel>
              <PanelResizeHandle
                id="sep-sidebar"
                style={{ width: 1, background: "rgba(255,255,255,0.07)", cursor: "col-resize", flexShrink: 0 }}
              />
            </>
          )}

          {/* Center: editor + bottom panel */}
          <Panel id="center-area" defaultSize={sidebarOpen ? "58%" : "72%"} minSize="25%">
            <PanelGroup orientation="vertical" id="compactlab-v" style={{ height: "100%" }}>
              <Panel id="editor" defaultSize={bottomPanelOpen ? "68%" : "100%"} minSize="25%">
                <div className="h-full overflow-hidden">
                  <CompactEditor />
                </div>
              </Panel>

              {bottomPanelOpen && (
                <>
                  <PanelResizeHandle
                    id="sep-bottom"
                    style={{ height: 1, background: "rgba(255,255,255,0.07)", cursor: "row-resize", flexShrink: 0 }}
                  />
                  <Panel id="bottom" defaultSize="32%" minSize="15%" maxSize="60%">
                    <div className="h-full overflow-hidden">
                      <BottomPanel />
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {/* Inspector — right panel */}
          <PanelResizeHandle
            id="sep-inspector"
            style={{ width: 1, background: "rgba(255,255,255,0.07)", cursor: "col-resize", flexShrink: 0 }}
          />
          <Panel id="inspector" defaultSize="28%" minSize="20%" maxSize="45%">
            <div className="h-full overflow-hidden">
              <InspectorPanel />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {!bottomPanelOpen && <CollapsedBottomBar />}

      {/* Global modal layer */}
      <NewProjectModal />
    </div>
  );
}

function CollapsedBottomBar() {
  const { setBottomPanelOpen, logs } = useIDEStore();
  return (
    <div className="flex items-center h-7 px-4 bg-surface border-t border-border flex-shrink-0 gap-3">
      <button
        onClick={() => setBottomPanelOpen(true)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        <svg className="w-3.5 h-3.5 rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Output Panel
        {logs.length > 0 && (
          <span className="ml-1 text-2xs bg-accent/20 text-accent rounded-sm px-1">{logs.length}</span>
        )}
      </button>
    </div>
  );
}
