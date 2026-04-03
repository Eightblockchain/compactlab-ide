"use client";

import { useRef } from "react";
import { useIDEStore } from "@/store/ide";
import type { ProjectFile } from "@/store/ide";
import { cn } from "@/lib/utils";

// ─── Language icons ────────────────────────────────────────────────────────────

function CompactTabIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0" stroke="currentColor" strokeWidth="1.2">
      <path d="M6 1L2 3v4l4 2 4-2V3L6 1z" strokeLinejoin="round" />
      <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MarkdownTabIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0" stroke="currentColor" strokeWidth="1.2">
      <path d="M1 2h10v8H1z" strokeLinejoin="round" />
      <path d="M3 8V5l2 2 2-2v3M9 8V5l-1 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function JsonTabIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0" stroke="currentColor" strokeWidth="1.2">
      <path d="M2 3.5C2 2.7 2.7 2 3.5 2S5 2.7 5 3.5v5C5 9.3 4.3 10 3.5 10" strokeLinecap="round" />
      <path d="M10 3.5C10 2.7 9.3 2 8.5 2S7 2.7 7 3.5v5c0 .8.7 1.5 1.5 1.5" strokeLinecap="round" />
    </svg>
  );
}

function FileTabIcon({ language }: { language: ProjectFile["language"] }) {
  const colors: Record<ProjectFile["language"], string> = {
    compact: "#F06358",   // brand coral
    markdown: "#60a5fa",  // info blue
    json: "#d4a853",      // warning amber
  };
  return (
    <span style={{ color: colors[language] }}>
      {language === "compact" && <CompactTabIcon />}
      {language === "markdown" && <MarkdownTabIcon />}
      {language === "json" && <JsonTabIcon />}
    </span>
  );
}

// ─── Single tab ────────────────────────────────────────────────────────────────

function Tab({
  file,
  isActive,
  isModified,
  onActivate,
  onClose,
}: {
  file: ProjectFile;
  isActive: boolean;
  isModified: boolean;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={onActivate}
      className={cn(
        "group relative flex items-center gap-1.5 px-3.5 h-full border-r border-border cursor-pointer select-none transition-colors flex-shrink-0",
        isActive
          ? "text-text-primary"
          : "text-text-muted hover:text-text-secondary hover:bg-white/3"
      )}
      style={
        isActive
          ? {
              background: "#111111",
              borderTop: "2px solid #F06358",
              // Slight optical correction so top border doesn't add height
              paddingTop: 2,
            }
          : { background: "transparent" }
      }
    >
      <FileTabIcon language={file.language} />

      <span className="text-xs font-medium whitespace-nowrap max-w-[120px] truncate">
        {file.name}
      </span>

      {/* Unsaved indicator or close button */}
      <div className="relative w-4 h-4 flex items-center justify-center flex-shrink-0">
        {/* Modified dot (visible when dirty and tab is inactive, or always on active) */}
        {isModified && (
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              "group-hover:opacity-0"
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#F06358" }}
            />
          </span>
        )}

        {/* Close ×  — always shown on active, shown on hover for inactive */}
        <button
          onClick={onClose}
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded transition-all",
            "hover:bg-white/10 hover:text-text-primary",
            isActive
              ? "opacity-100 text-text-muted"
              : isModified
              ? "opacity-0 group-hover:opacity-100 text-text-muted"
              : "opacity-0 group-hover:opacity-100 text-text-muted"
          )}
          title="Close tab"
        >
          <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-2.5 h-2.5">
            <path d="M1 1l6 6M7 1l-6 6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Tab bar ───────────────────────────────────────────────────────────────────

export function EditorTabBar() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    openTabIds,
    activeFileId,
    activeProject,
    isDirty,
    openTab,
    closeTab,
  } = useIDEStore();

  // Build the ordered list of open files from the active project
  const openFiles = openTabIds
    .map((id) => activeProject?.files.find((f) => f.id === id))
    .filter((f): f is ProjectFile => f !== undefined);

  // Scroll tabs with the mouse wheel (horizontal)
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      className="flex items-stretch flex-shrink-0 border-b border-border"
      style={{ background: "#0d0d0d", height: 36 }}
    >
      {/* Scrollable tab strip */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex items-stretch overflow-x-auto flex-1 min-w-0"
        style={{
          scrollbarWidth: "none",        // Firefox
          msOverflowStyle: "none",       // IE/Edge
        }}
      >
        {openFiles.length === 0 && (
          <div className="flex items-center px-4 text-xs text-text-dim select-none">
            No file open
          </div>
        )}

        {openFiles.map((file) => {
          const isActive = file.id === activeFileId;
          const isModified = isActive && isDirty;
          return (
            <Tab
              key={file.id}
              file={file}
              isActive={isActive}
              isModified={isModified}
              onActivate={() => openTab(file.id)}
              onClose={(e) => {
                e.stopPropagation();
                closeTab(file.id);
              }}
            />
          );
        })}

        {/* Drop zone / new tab area */}
        <div className="flex-1 min-w-4" />
      </div>

      {/* Right status info — always visible, never scrolls */}
      <div
        className="flex items-center gap-3 px-4 text-2xs font-mono flex-shrink-0 border-l border-border"
        style={{ color: "#636360" }}
      >
        {activeFileId && activeProject && (
          <>
            <span style={{ color: "#555552" }}>
              {activeProject.files.find((f) => f.id === activeFileId)?.language === "compact"
                ? "Compact v0.14"
                : activeProject.files.find((f) => f.id === activeFileId)?.language === "markdown"
                ? "Markdown"
                : "JSON"}
            </span>
            <span style={{ color: "#3d3d3a" }}>│</span>
          </>
        )}
        <span>Midnight Devnet</span>
        <span style={{ color: "#3d3d3a" }}>│</span>
        <span>
          <kbd className="font-sans">⌘S</kbd> Save
        </span>
        <span>
          <kbd className="font-sans">⌘↵</kbd> Run
        </span>
      </div>
    </div>
  );
}
