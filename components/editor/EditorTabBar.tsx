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
        "group relative flex items-center gap-1.5 pl-3 pr-2 h-full border-r border-border cursor-pointer select-none transition-colors flex-shrink-0",
        isActive
          ? "text-text-primary bg-surface"
          : "text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
      )}
    >
      {isActive && <span className="absolute inset-x-0 top-0 h-px bg-accent" aria-hidden />}
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
            <span className="w-1.5 h-1.5 rounded-full bg-text-secondary" />
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
      className="flex items-stretch flex-shrink-0 h-9 border-b border-border bg-background"
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

    </div>
  );
}
