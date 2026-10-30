"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { useIDEStore } from "@/store/ide";
import { useAuth } from "@/hooks/useAuth";
import { Topbar } from "@/components/layout/Topbar";
import { NoticeBar } from "@/components/layout/NoticeBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { HelpDrawer } from "@/components/layout/HelpDrawer";
import { Sidebar } from "@/components/layout/Sidebar";
import { CompactEditor } from "@/components/editor/CompactEditor";
import { InspectorPanel } from "@/components/panels/InspectorPanel";
import { BottomPanel } from "@/components/panels/BottomPanel";
import { NewProjectModal } from "@/components/modals/NewProjectModal";
import { WorkSafety } from "@/components/layout/WorkSafety";
import { BetaWelcome } from "@/components/modals/BetaWelcomeModal";

export default function PlaygroundPage() {
  return (
    <>
      <WorkSafety />
      <Playground />
    </>
  );
}

function Playground() {
  const {
    activeProjectId,
    projects,
    loadProject,
    sidebarOpen,
    bottomPanelOpen,
    hydrateProjectsFromCloud,
    projectsHydrated,
    clearWorkspace,
  } = useIDEStore();
  const { user, loading: authLoading, maintenance } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // During maintenance /v1/me answers 503: the user is still signed in, so keep their workspace.
    if (mounted && !authLoading && !user && !maintenance) {
      clearWorkspace();
      router.replace("/login");
    }
  }, [mounted, authLoading, user, maintenance, router, clearWorkspace]);

  useEffect(() => {
    if (!mounted || authLoading || !user) return;
    void hydrateProjectsFromCloud();
  }, [mounted, authLoading, user, hydrateProjectsFromCloud]);

  useEffect(() => {
    if (projectsHydrated && !activeProjectId && projects.length > 0) {
      loadProject(projects[0]!.id);
    }
  }, [projectsHydrated, activeProjectId, projects, loadProject]);

  if (!mounted || authLoading || !user || !projectsHydrated) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#09090b",
          color: "#71717a",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
          gap: "16px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cl-icon.png"
          alt=""
          width={40}
          height={40}
          style={{ objectFit: "contain", opacity: 0.95 }}
          draggable={false}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid #F06358",
              borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }}
          />
          Loading CompactLab…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <Topbar />
      <NoticeBar />

      {/* Main IDE body — flex-1 + min-h-0 are critical for nested panels */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PanelGroup orientation="horizontal" id="compactlab-h" style={{ height: "100%" }}>
          {/* Sidebar */}
          {sidebarOpen && (
            <>
              <Panel id="sidebar" defaultSize="15%" minSize="220px" maxSize="25%">
                <div className="h-full overflow-hidden">
                  <Sidebar />
                </div>
              </Panel>
              <PanelResizeHandle
                id="sep-sidebar"
                style={{ width: 1, cursor: "col-resize" }}
              />
            </>
          )}

          {/* Center: editor + bottom panel */}
          <Panel id="center-area" defaultSize={sidebarOpen ? "59%" : "74%"} minSize="25%">
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
                    style={{ height: 1, cursor: "row-resize" }}
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
            style={{ width: 1, cursor: "col-resize" }}
          />
          <Panel id="inspector" defaultSize="26%" minSize="300px" maxSize="45%">
            <div className="h-full overflow-hidden">
              <InspectorPanel />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {!bottomPanelOpen && <CollapsedBottomBar />}
      <StatusBar />

      {/* Global modal layer */}
      <NewProjectModal />
      <HelpDrawer />
      <BetaWelcome />
    </div>
  );
}

function CollapsedBottomBar() {
  const { setBottomPanelOpen, logs } = useIDEStore();
  return (
    <div className="flex items-center h-7 px-3 bg-background border-t border-border flex-shrink-0 gap-3">
      <button
        onClick={() => setBottomPanelOpen(true)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        <svg className="w-3.5 h-3.5 rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Output
        {logs.length > 0 && (
          <span className="ml-0.5 text-2xs font-mono bg-white/[0.06] text-text-muted rounded px-1">{logs.length}</span>
        )}
      </button>
    </div>
  );
}
