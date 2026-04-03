"use client";

import { useRef } from "react";
import { useIDEStore } from "@/store/ide";
import type { ProjectFile } from "@/store/ide";
import { FileIcon } from "@/components/ui/file-icons";
import { cn } from "@/lib/utils";

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
      <span className="flex-shrink-0">
        <FileIcon filename={file.name} size={13} />
      </span>

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
              {(() => {
                const f = activeProject.files.find((f) => f.id === activeFileId);
                if (!f) return "";
                const name = f.name.toLowerCase();
                if (name.endsWith(".compact")) return "Compact v0.14";
                if (name.endsWith(".md") || name.endsWith(".mdx")) return "Markdown";
                if (name.endsWith(".json")) return "JSON";
                if (name.endsWith(".ts") || name.endsWith(".tsx")) return "TypeScript";
                if (name.endsWith(".js") || name.endsWith(".jsx")) return "JavaScript";
                if (name.endsWith(".rs")) return "Rust";
                if (name.endsWith(".py")) return "Python";
                if (name.endsWith(".go")) return "Go";
                if (name.endsWith(".sol")) return "Solidity";
                if (name.endsWith(".css")) return "CSS";
                if (name.endsWith(".scss")) return "SCSS";
                if (name.endsWith(".html")) return "HTML";
                if (name.endsWith(".sh") || name.endsWith(".bash")) return "Shell";
                if (name.endsWith(".yml") || name.endsWith(".yaml")) return "YAML";
                if (name.endsWith(".toml")) return "TOML";
                return f.language;
              })()}
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
