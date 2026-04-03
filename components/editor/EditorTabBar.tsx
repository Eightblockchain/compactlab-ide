"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useIDEStore } from "@/store/ide";
import type { ProjectFile } from "@/store/ide";
import { FileIcon } from "@/components/ui/file-icons";
import { cn } from "@/lib/utils";
import { COMPACT_VERSIONS, COMPACT_STABLE_VERSION } from "@/lib/version";
import type { CompactVersion } from "@/lib/version";

// ─── Compact version picker ────────────────────────────────────────────────────

function CompactVersionPicker({
  current,
  onChange,
}: {
  current: CompactVersion;
  onChange: (v: CompactVersion) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Switch Compact language version"
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors",
          "hover:bg-white/8 hover:text-text-secondary",
          open && "bg-white/8 text-text-secondary"
        )}
        style={{ color: "#555552" }}
      >
        <span>Compact v{current}</span>
        <svg viewBox="0 0 8 5" fill="currentColor" className="w-2 h-1.5 opacity-60">
          <path d="M0 0l4 5 4-5H0z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 right-0 z-50 rounded-md border border-border shadow-xl overflow-hidden"
          style={{ background: "#151515", minWidth: 170 }}
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-2xs text-text-muted font-medium uppercase tracking-wider">Compact Language</p>
          </div>
          {COMPACT_VERSIONS.map((v) => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors",
                v === current
                  ? "text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/5"
              )}
            >
              <span>v{v}</span>
              <span className="flex items-center gap-1.5">
                {v === COMPACT_STABLE_VERSION && (
                  <span className="text-2xs px-1.5 py-0.5 rounded-sm bg-success/10 text-success">stable</span>
                )}
                {v === current && (
                  <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
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
    compactVersion,
    setCompactVersion,
    code,
    setCode,
    saveProject,
  } = useIDEStore();

  // ── Sync picker → file: update pragma when user picks a version ────────────
  const handleVersionChange = useCallback((v: CompactVersion) => {
    setCompactVersion(v);
    const updated = code.replace(
      /pragma language_version\s*>=\s*[\d.]+;/,
      `pragma language_version >= ${v};`
    );
    if (updated !== code) {
      setCode(updated);
      // setCode marks the file dirty but auto-save only fires via Monaco's
      // onChange. Schedule a save explicitly so the user doesn't have to.
      setTimeout(() => saveProject(), 0);
    }
  }, [code, setCompactVersion, setCode, saveProject]);

  // ── Sync file → picker: read pragma when switching tabs ───────────────────
  useEffect(() => {
    if (!activeFileId || !activeProject) return;
    const f = activeProject.files.find((f) => f.id === activeFileId);
    if (!f?.name.toLowerCase().endsWith(".compact")) return;
    const match = code.match(/pragma language_version\s*>=\s*([\d.]+)/);
    if (!match) return;
    // Normalise "0.20.0" → "0.20"
    const normalized = match[1].split(".").slice(0, 2).join(".");
    if ((COMPACT_VERSIONS as readonly string[]).includes(normalized)) {
      setCompactVersion(normalized as CompactVersion);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId]); // Only re-run on tab switch, not on every keystroke

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
            {(() => {
              const f = activeProject.files.find((f) => f.id === activeFileId);
              if (!f) return null;
              const name = f.name.toLowerCase();
              if (name.endsWith(".compact")) {
                return (
                  <CompactVersionPicker
                    current={compactVersion}
                    onChange={handleVersionChange}
                  />
                );
              }
              const label =
                name.endsWith(".md") || name.endsWith(".mdx") ? "Markdown" :
                name.endsWith(".json") ? "JSON" :
                name.endsWith(".ts") || name.endsWith(".tsx") ? "TypeScript" :
                name.endsWith(".js") || name.endsWith(".jsx") ? "JavaScript" :
                name.endsWith(".rs") ? "Rust" :
                name.endsWith(".py") ? "Python" :
                name.endsWith(".go") ? "Go" :
                name.endsWith(".sol") ? "Solidity" :
                name.endsWith(".css") ? "CSS" :
                name.endsWith(".scss") ? "SCSS" :
                name.endsWith(".html") ? "HTML" :
                name.endsWith(".sh") || name.endsWith(".bash") ? "Shell" :
                name.endsWith(".yml") || name.endsWith(".yaml") ? "YAML" :
                name.endsWith(".toml") ? "TOML" : f.language;
              return <span style={{ color: "#555552" }}>{label}</span>;
            })()}
            <span style={{ color: "#3d3d3a" }}>│</span>
          </>
        )}
        <span>Midnight Devnet</span>
        <span style={{ color: "#3d3d3a" }}>│</span>
        <button
          onClick={() => saveProject()}
          title="Save (⌘S)"
          className="flex items-center gap-1 px-1 rounded hover:bg-white/8 hover:text-text-secondary transition-colors"
        >
          <kbd className="font-sans">⌘S</kbd> Save
        </button>
        <span>
          <kbd className="font-sans">⌘↵</kbd> Compile
        </span>
      </div>
    </div>
  );
}
