"use client";

import { useState, useRef, useEffect } from "react";
import { useIDEStore } from "@/store/ide";
import type { Project, ProjectFile, ProjectFolder } from "@/store/ide";
import { IconButton } from "@/components/ui";
import { FileIcon, FolderIcon, MidnightIcon, getFolderColor } from "@/components/ui/file-icons";
import { cn } from "@/lib/utils";
import { COMPACT_TEMPLATES, GENERATED_EMPTY_FOLDER_NAMES } from "@/lib/constants";
import { isDeployableTemplate } from "@/lib/playground-deploy";

const _MODULE_NOW = Date.now();

function formatRelativeTime(ts: number): string {
  const diff = _MODULE_NOW - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

/** VS Code / Cursor default explorer order: folders first, then files; both A→Z. */
function byNameAsc<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function folderHasContent(
  folderId: string,
  allFolders: ProjectFolder[],
  allFiles: ProjectFile[],
): boolean {
  if (allFiles.some((f) => f.folderId === folderId)) return true;
  return allFolders.some(
    (f) => f.parentId === folderId && folderHasContent(f.id, allFolders, allFiles),
  );
}

/** Hide empty runtime/build placeholders (dist, midnight-level-db, …). */
function shouldShowFolder(
  folder: ProjectFolder,
  allFolders: ProjectFolder[],
  allFiles: ProjectFile[],
): boolean {
  if (!GENERATED_EMPTY_FOLDER_NAMES.has(folder.name)) return true;
  return folderHasContent(folder.id, allFolders, allFiles);
}

/** Scaffold / Compact artifact names — renaming breaks Midnight paths & scripts. */
const LOCKED_FOLDER_NAMES = new Set([
  "contracts",
  "src",
  "managed",
  "compiler",
  "keys",
  "zkir",
  "contract",
  "dist",
  "midnight-level-db",
  "node_modules",
]);

const LOCKED_FILE_NAMES = new Set([
  "package.json",
  "tsconfig.json",
  "deployment.json",
  "providers.ts",
]);

function folderAncestorNames(
  folderId: string | null | undefined,
  allFolders: ProjectFolder[],
): string[] {
  const names: string[] = [];
  let id = folderId ?? null;
  const byId = new Map(allFolders.map((f) => [f.id, f]));
  while (id) {
    const f = byId.get(id);
    if (!f) break;
    names.push(f.name);
    id = f.parentId;
  }
  return names;
}

function isUnderManaged(
  folderId: string | null | undefined,
  allFolders: ProjectFolder[],
): boolean {
  return folderAncestorNames(folderId, allFolders).some(
    (n) => n.toLowerCase() === "managed",
  );
}

/** Only user-owned `.compact` sources — not managed compiler output. */
function canRenameFile(
  file: ProjectFile,
  allFolders: ProjectFolder[],
): boolean {
  if (LOCKED_FILE_NAMES.has(file.name)) return false;
  if (isUnderManaged(file.folderId, allFolders)) return false;
  return (
    file.language === "compact" || file.name.toLowerCase().endsWith(".compact")
  );
}

function canRenameFolder(
  folder: ProjectFolder,
  allFolders: ProjectFolder[],
): boolean {
  if (LOCKED_FOLDER_NAMES.has(folder.name.toLowerCase())) return false;
  if (isUnderManaged(folder.id, allFolders)) return false;
  if (isUnderManaged(folder.parentId, allFolders)) return false;
  // Only allow renaming user-created folders (not scaffold roots / artifact dirs)
  return true;
}

// ─── Template tag ──────────────────────────────────────────────────────────────

function TemplateTag({ difficulty }: { difficulty: string }) {
  const map: Record<string, { label: string; color: string }> = {
    beginner: { label: "Beginner", color: "text-success bg-success/10" },
    intermediate: { label: "Intermediate", color: "text-warning bg-warning/10" },
    advanced: { label: "Advanced", color: "text-error bg-error/10" },
  };
  const tag = map[difficulty] ?? { label: difficulty, color: "text-text-muted bg-white/5" };
  return (
    <span className={cn("text-2xs font-medium px-1.5 py-0.5 rounded-sm", tag.color)}>
      {tag.label}
    </span>
  );
}

// ─── Inline forms ──────────────────────────────────────────────────────────────

function AddFileForm({ onAdd, onCancel }: { onAdd: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-0.5 mb-1 mr-2">
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md"
        style={{ background: "rgba(240,99,88,0.06)", border: "1px solid rgba(240,99,88,0.18)" }}
      >
        <FileIcon filename={value || "untitled.compact"} size={13} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onAdd(value.trim());
            if (e.key === "Escape") onCancel();
          }}
          placeholder="filename.compact"
          autoFocus
          className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-dim focus:outline-none min-w-0"
        />
        <button
          onClick={() => value.trim() && onAdd(value.trim())}
          className="text-accent hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
            <path d="M5 1v8M1 5h8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AddFolderForm({ onAdd, onCancel }: { onAdd: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-0.5 mb-1 mr-2">
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md"
        style={{ background: "rgba(220,182,122,0.08)", border: "1px solid rgba(220,182,122,0.25)" }}
      >
        <FolderIcon open size={14} color={getFolderColor(value || "")} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onAdd(value.trim());
            if (e.key === "Escape") onCancel();
          }}
          placeholder="folder-name"
          autoFocus
          className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-dim focus:outline-none min-w-0"
        />
        <button
          onClick={() => value.trim() && onAdd(value.trim())}
          className="text-[#DCB67A] hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
            <path d="M5 1v8M1 5h8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Inline rename ─────────────────────────────────────────────────────────────

function InlineRenameInput({
  initial,
  onCommit,
  onCancel,
  placeholder,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const dot = initial.lastIndexOf(".");
    if (dot > 0) el.setSelectionRange(0, dot);
    else el.select();
  }, [initial]);

  const commit = () => {
    const next = value.trim();
    if (!next || next === initial) {
      onCancel();
      return;
    }
    onCommit(next);
  };

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      placeholder={placeholder}
      className="flex-1 min-w-0 bg-white/8 border border-accent/40 rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none"
    />
  );
}

// ─── File row ──────────────────────────────────────────────────────────────────

function FileRow({
  file,
  isActive,
  canDelete,
  canRename = false,
  depth = 0,
  onClick,
  onDelete,
  onRename,
}: {
  file: ProjectFile;
  isActive: boolean;
  canDelete: boolean;
  canRename?: boolean;
  depth?: number;
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const pl = 28 + depth * 16;

  return (
    <div
      onClick={() => {
        if (!renaming) onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (canRename) setRenaming(true);
      }}
      className={cn(
        "group flex items-center gap-1.5 pr-2 h-6 rounded cursor-pointer transition-colors",
        isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
      )}
      style={{ paddingLeft: pl }}
      title={canRename ? "Double-click to rename" : undefined}
    >
      <span className="flex-shrink-0 opacity-90">
        <FileIcon filename={file.name} size={14} />
      </span>
      {renaming && canRename ? (
        <InlineRenameInput
          initial={file.name}
          onCommit={(name) => {
            const next = name.trim();
            // Keep Compact sources as .compact so compile / language stay valid
            const safe =
              next.toLowerCase().endsWith(".compact") ? next : `${next.replace(/\.+$/, "")}.compact`;
            onRename(safe);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
          placeholder="contract.compact"
        />
      ) : (
        <span
          className={cn(
            "text-xs flex-1 truncate",
            isActive ? "text-text-primary font-medium" : "text-text-secondary group-hover:text-text-primary",
          )}
        >
          {file.name}
        </span>
      )}
      {!renaming && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
          {canRename && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenaming(true);
              }}
              className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6"
              title="Rename file"
            >
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
                <path d="M1.5 7.5l5.2-5.2 1.5 1.5L3 9H1.5V7.5z" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-error hover:bg-error/10"
              title="Delete file"
            >
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
                <path d="M1 1l6 6M7 1l-6 6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recursive folder node ─────────────────────────────────────────────────────

function FolderNode({
  folder,
  allFolders,
  allFiles,
  isActive,
  activeFileId,
  totalFileCount,
  depth,
  defaultOpen = false,
  onFileClick,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
  onRenameFolder,
  onAddFile,
  onAddSubfolder,
}: {
  folder: ProjectFolder;
  allFolders: ProjectFolder[];
  allFiles: ProjectFile[];
  isActive: boolean;
  activeFileId: string | null;
  totalFileCount: number;
  depth: number;
  /** Only `contracts/` starts open so the default .compact file is visible. */
  defaultOpen?: boolean;
  onFileClick: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFile: (fileId: string, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onAddFile: (name: string, folderId: string) => void;
  onAddSubfolder: (name: string, parentId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const [nodeAdding, setNodeAdding] = useState<"none" | "file" | "subfolder">("none");
  const [renaming, setRenaming] = useState(false);

  const directFiles = allFiles
    .filter((f) => f.folderId === folder.id)
    .slice()
    .sort(byNameAsc);
  const subFolders = allFolders
    .filter((f) => f.parentId === folder.id)
    .filter((f) => shouldShowFolder(f, allFolders, allFiles))
    .slice()
    .sort(byNameAsc);

  // Under contracts/: *.compact first, then managed/ (collapsed).
  const contractsLayout = folder.name === "contracts";

  const folderPl = 24 + depth * 16;
  const contentPl = folderPl + 16;
  const folderColor = getFolderColor(folder.name);
  const isManagedTree = /^(managed|compiler|contract|keys|zkir)$/i.test(folder.name);
  const isEmpty = directFiles.length === 0 && subFolders.length === 0 && nodeAdding === "none";
  const folderRenamable = canRenameFolder(folder, allFolders);

  function openAndAdd(kind: "file" | "subfolder") {
    setCollapsed(false);
    setNodeAdding(kind);
  }

  const sharedFolderProps = {
    allFolders,
    allFiles,
    isActive,
    activeFileId,
    totalFileCount,
    depth: depth + 1,
    defaultOpen: false as const,
    onFileClick,
    onDeleteFile,
    onDeleteFolder,
    onRenameFile,
    onRenameFolder,
    onAddFile,
    onAddSubfolder,
  };

  return (
    <div>
      {/* Folder header */}
      <div
        className="group flex items-center gap-1.5 pr-2 h-6 rounded hover:bg-white/[0.03] cursor-pointer transition-colors"
        style={{ paddingLeft: folderPl }}
        onClick={() => {
          if (!renaming) setCollapsed((c) => !c);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (folderRenamable) setRenaming(true);
        }}
        title={folderRenamable ? "Double-click to rename" : undefined}
      >
        <svg
          viewBox="0 0 6 6"
          fill="currentColor"
          className={cn(
            "w-1.5 h-1.5 flex-shrink-0 text-text-dim transition-transform duration-150",
            !collapsed ? "rotate-90" : "",
          )}
        >
          <path d="M1 0.5l4 2.5-4 2.5V0.5z" />
        </svg>

        <span className="flex-shrink-0">
          <FolderIcon open={!collapsed} size={15} color={folderColor} />
        </span>

        {renaming && folderRenamable ? (
          <InlineRenameInput
            initial={folder.name}
            onCommit={(name) => {
              onRenameFolder(folder.id, name);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
            placeholder="folder-name"
          />
        ) : (
          <span
            className={cn(
              "text-xs flex-1 truncate min-w-0",
              isManagedTree ? "text-text-muted font-medium" : "text-text-secondary",
            )}
          >
            {folder.name}
          </span>
        )}
        {isEmpty && !renaming && (
          <span className="text-2xs text-text-dim opacity-0 group-hover:opacity-100 transition-opacity">
            empty
          </span>
        )}

        {!renaming && (
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {folderRenamable && (
              <button
                onClick={() => setRenaming(true)}
                className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
                title="Rename folder"
              >
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
                  <path d="M1.5 7.5l5.2-5.2 1.5 1.5L3 9H1.5V7.5z" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button
              onClick={() => openAndAdd("file")}
              className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
              title="New file"
            >
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-2 h-2">
                <path d="M5 1v8M1 5h8" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => openAndAdd("subfolder")}
              className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-[#DCB67A] hover:bg-[#DCB67A]/10 transition-colors"
              title="New sub-folder"
            >
              <svg viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3 h-2.5">
                <path d="M1 2h3.5l1 1H11v6H1V2z" strokeLinejoin="round" />
                <path d="M6 5.5v2M5 6.5h2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => onDeleteFolder(folder.id)}
              className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-error hover:bg-error/10 transition-colors"
              title="Delete folder"
            >
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
                <path d="M1 1l6 6M7 1l-6 6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div>
          {contractsLayout ? (
            <>
              {directFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  isActive={isActive && file.id === activeFileId}
                  canDelete={
                    totalFileCount > 1 &&
                    !LOCKED_FILE_NAMES.has(file.name) &&
                    !isUnderManaged(file.folderId, allFolders)
                  }
                  canRename={canRenameFile(file, allFolders)}
                  depth={depth + 1}
                  onClick={() => onFileClick(file.id)}
                  onDelete={() => onDeleteFile(file.id)}
                  onRename={(name) => onRenameFile(file.id, name)}
                />
              ))}
              {subFolders.map((sub) => (
                <FolderNode key={sub.id} folder={sub} {...sharedFolderProps} />
              ))}
            </>
          ) : (
            <>
              {subFolders.map((sub) => (
                <FolderNode key={sub.id} folder={sub} {...sharedFolderProps} />
              ))}
              {directFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  isActive={isActive && file.id === activeFileId}
                  canDelete={
                    totalFileCount > 1 &&
                    !LOCKED_FILE_NAMES.has(file.name) &&
                    !isUnderManaged(file.folderId, allFolders)
                  }
                  canRename={canRenameFile(file, allFolders)}
                  depth={depth + 1}
                  onClick={() => onFileClick(file.id)}
                  onDelete={() => onDeleteFile(file.id)}
                  onRename={(name) => onRenameFile(file.id, name)}
                />
              ))}
            </>
          )}
          {nodeAdding === "file" && (
            <div style={{ paddingLeft: contentPl }}>
              <AddFileForm
                onAdd={(name) => { onAddFile(name, folder.id); setNodeAdding("none"); }}
                onCancel={() => setNodeAdding("none")}
              />
            </div>
          )}
          {nodeAdding === "subfolder" && (
            <div style={{ paddingLeft: folderPl }}>
              <AddFolderForm
                onAdd={(name) => { onAddSubfolder(name, folder.id); setNodeAdding("none"); }}
                onCancel={() => setNodeAdding("none")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Project folder (top-level sidebar item) ───────────────────────────────────

type RootAddingState = { type: "none" } | { type: "file" } | { type: "folder" };

function ProjectFolderItem({
  project,
  isActive,
  isExpanded,
  activeFileId,
  onToggle,
  onLoadProject,
  onSetActiveFile,
  onDelete,
  onAddFile,
  onAddFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
  onRenameFolder,
}: {
  project: Project;
  isActive: boolean;
  isExpanded: boolean;
  activeFileId: string | null;
  onToggle: () => void;
  onLoadProject: () => void;
  onSetActiveFile: (id: string) => void;
  onDelete: () => void;
  onAddFile: (name: string, folderId: string | null) => void;
  onAddFolder: (name: string, parentId: string | null) => void;
  onDeleteFile: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFile: (fileId: string, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
}) {
  const [rootAdding, setRootAdding] = useState<RootAddingState>({ type: "none" });

  const allFolders = project.folders ?? [];
  const allFiles = project.files;
  const rootFolders = allFolders
    .filter((f) => !f.parentId)
    .filter((f) => shouldShowFolder(f, allFolders, allFiles))
    .slice()
    .sort(byNameAsc);
  const rootFiles = allFiles
    .filter((f) => !f.folderId)
    .slice()
    .sort(byNameAsc);

  return (
    <div className="mb-0.5">
      {/* Project header */}
      <div
        className={cn(
          "group flex items-center gap-1 px-1.5 h-7 rounded cursor-pointer transition-colors",
          isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.03]",
        )}
      >
        {/* Expand chevron */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        >
          <svg
            viewBox="0 0 6 6"
            fill="currentColor"
            className={cn("w-1.5 h-1.5 transition-transform duration-150", isExpanded ? "rotate-90" : "")}
          >
            <path d="M1 0.5l4 2.5-4 2.5V0.5z" />
          </svg>
        </button>

        {/* Material folder + project name */}
        <div onClick={onLoadProject} className="flex items-center gap-1.5 flex-1 min-w-0">
          <FolderIcon open={isExpanded} size={15} color={isActive ? "#F06358" : "#71717a"} />
          <span
            className={cn(
              "text-xs font-medium truncate flex-1 min-w-0",
              isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary",
            )}
          >
            {project.name}
          </span>
          {project.deployResult?.contractAddress && (
            <span
              className="text-2xs px-1 py-0.5 rounded bg-success/10 text-success flex-shrink-0"
              title={project.deployResult.contractAddress}
            >
              deployed
            </span>
          )}
        </div>

        {!isExpanded && (
          <span className="text-2xs text-text-dim flex-shrink-0 group-hover:hidden">
            {formatRelativeTime(project.updatedAt)}
          </span>
        )}

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setRootAdding({ type: "file" }); }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
            title="New file"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M5.5 1H2.5a1 1 0 00-1 1v6a1 1 0 001 1h5a1 1 0 001-1V4L5.5 1z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 1v3h3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 4.5v2.5M3.5 6H6.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setRootAdding({ type: "folder" }); }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
            title="New folder"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M1 3h3l1 1h4v4.5H1V3z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 5v2M4 6h2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-error hover:bg-error/10 transition-colors"
            title="Delete project"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded tree — folders first, then files (VS Code / Cursor default) */}
      {isExpanded && (
        <div className="mb-1.5 ml-[13px] border-l border-border pl-1">
          {rootFolders.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              allFolders={allFolders}
              allFiles={allFiles}
              isActive={isActive}
              activeFileId={activeFileId}
              totalFileCount={allFiles.length}
              depth={0}
              defaultOpen={folder.name === "contracts"}
              onFileClick={(fileId) => { if (!isActive) onLoadProject(); onSetActiveFile(fileId); }}
              onDeleteFile={(fileId) => onDeleteFile(fileId)}
              onDeleteFolder={(folderId) => onDeleteFolder(folderId)}
              onRenameFile={onRenameFile}
              onRenameFolder={onRenameFolder}
              onAddFile={(name, folderId) => onAddFile(name, folderId)}
              onAddSubfolder={(name, parentId) => onAddFolder(name, parentId)}
            />
          ))}
          {rootFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              isActive={isActive && file.id === activeFileId}
              canDelete={
                allFiles.length > 1 &&
                !LOCKED_FILE_NAMES.has(file.name) &&
                !isUnderManaged(file.folderId, allFolders)
              }
              canRename={canRenameFile(file, allFolders)}
              depth={0}
              onClick={() => { if (!isActive) onLoadProject(); onSetActiveFile(file.id); }}
              onDelete={() => onDeleteFile(file.id)}
              onRename={(name) => onRenameFile(file.id, name)}
            />
          ))}
          {rootAdding.type === "file" && (
            <div className="pl-7">
              <AddFileForm
                onAdd={(name) => { onAddFile(name, null); setRootAdding({ type: "none" }); }}
                onCancel={() => setRootAdding({ type: "none" })}
              />
            </div>
          )}
          {rootAdding.type === "folder" && (
            <div className="pl-2">
              <AddFolderForm
                onAdd={(name) => { onAddFolder(name, null); setRootAdding({ type: "none" }); }}
                onCancel={() => setRootAdding({ type: "none" })}
              />
            </div>
          )}
          {rootAdding.type === "none" && (
            <div className="mx-2 mt-1 mb-0.5 flex items-center gap-3">
              <button
                onClick={() => setRootAdding({ type: "file" })}
                className="flex items-center gap-1 py-0.5 text-2xs text-text-dim hover:text-text-muted transition-colors"
              >
                <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2 h-2">
                  <path d="M4 1v6M1 4h6" strokeLinecap="round" />
                </svg>
                File
              </button>
              <button
                onClick={() => setRootAdding({ type: "folder" })}
                className="flex items-center gap-1 py-0.5 text-2xs text-text-dim hover:text-text-muted transition-colors"
              >
                <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2 h-2">
                  <path d="M1 3h2l1 1h3v3H1V3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Folder
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main sidebar ──────────────────────────────────────────────────────────────

type SidebarTab = "projects" | "templates";

export function Sidebar() {
  const [tab, setTab] = useState<SidebarTab>("projects");
  const [closedByUser, setClosedByUser] = useState<Set<string>>(new Set());
  const [openedByUser, setOpenedByUser] = useState<Set<string>>(new Set());

  const {
    projects,
    activeProjectId,
    activeFileId,
    loadProject,
    setActiveFile,
    addFile,
    deleteFile,
    deleteProject,
    addFolder,
    deleteFolder,
    renameFile,
    renameFolder,
    setNewProjectModalOpen,
    createProject,
    sidebarRevealFolderIds,
    clearSidebarReveal,
  } = useIDEStore();

  useEffect(() => {
    if (!sidebarRevealFolderIds.length) return;
    setOpenedByUser((prev) => new Set([...prev, ...sidebarRevealFolderIds]));
    setClosedByUser((prev) => {
      const n = new Set(prev);
      for (const id of sidebarRevealFolderIds) n.delete(id);
      return n;
    });
    clearSidebarReveal();
  }, [sidebarRevealFolderIds, clearSidebarReveal]);

  function isExpanded(id: string): boolean {
    if (closedByUser.has(id)) return false;
    if (id === activeProjectId) return true;
    return openedByUser.has(id);
  }

  function toggleExpand(id: string) {
    if (isExpanded(id)) {
      setClosedByUser((prev) => new Set([...prev, id]));
      setOpenedByUser((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      setOpenedByUser((prev) => new Set([...prev, id]));
      setClosedByUser((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  function handleLoadProject(id: string) {
    loadProject(id);
    setClosedByUser((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  function handleAddFile(projectId: string, name: string, folderId: string | null) {
    let lang: ProjectFile["language"] = "compact";
    if (name.endsWith(".md") || name.endsWith(".mdx")) lang = "markdown";
    else if (name.endsWith(".json")) lang = "json";
    if (projectId !== activeProjectId) loadProject(projectId);
    addFile(name, lang, folderId);
  }

  function handleAddFolder(projectId: string, name: string, parentId: string | null) {
    if (projectId !== activeProjectId) loadProject(projectId);
    addFolder(name, parentId);
  }

  function handleRenameFile(projectId: string, fileId: string, name: string) {
    if (projectId !== activeProjectId) loadProject(projectId);
    renameFile(fileId, name);
  }

  function handleRenameFolder(projectId: string, folderId: string, name: string) {
    if (projectId !== activeProjectId) loadProject(projectId);
    renameFolder(folderId, name);
  }

  const templates = Object.entries(COMPACT_TEMPLATES)
    .filter(([id]) => id !== "blank")
    .map(([id, t]) => ({
      id,
      name: t.name,
      description: t.description,
      difficulty: t.difficulty,
    }));

  return (
    <aside className="flex flex-col bg-surface border-r border-border h-full w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-stretch justify-between h-9 pr-1.5 border-b border-border bg-background flex-shrink-0">
        <div className="flex items-stretch" role="tablist" aria-label="Sidebar">
          {(["projects", "templates"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "relative px-3 text-xs font-medium capitalize transition-colors",
                tab === id ? "text-text-primary bg-surface" : "text-text-muted hover:text-text-secondary",
              )}
            >
              {id}
              {tab === id && <span className="absolute inset-x-0 top-0 h-px bg-accent" aria-hidden />}
            </button>
          ))}
        </div>
        {tab === "projects" && (
          <IconButton
            size="sm"
            title="New project"
            className="self-center"
            onClick={() => setNewProjectModalOpen(true, "blank")}
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
              <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </IconButton>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "projects" && (
          <div className="p-1.5 space-y-px">
            {projects.length === 0 && (
              <div className="text-center py-10 px-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <FolderIcon size={22} color="#636360" />
                </div>
                <p className="text-sm text-text-muted">0 projects</p>
                <p className="text-xs text-text-dim mt-1 mb-3 leading-relaxed">
                  Create Hello World (bundled keys) or any template. Flow: Compile then Deploy with 1AM.
                </p>
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setNewProjectModalOpen(true, "blank")}
                    className="text-xs text-accent hover:underline"
                  >
                    + New project
                  </button>
                  <button
                    onClick={() => setTab("templates")}
                    className="text-xs text-text-secondary hover:text-text-primary hover:underline"
                  >
                    Browse templates
                  </button>
                </div>
              </div>
            )}
            {projects.map((project) => (
              <ProjectFolderItem
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                isExpanded={isExpanded(project.id)}
                activeFileId={project.id === activeProjectId ? activeFileId : null}
                onToggle={() => toggleExpand(project.id)}
                onLoadProject={() => handleLoadProject(project.id)}
                onSetActiveFile={(fid) => setActiveFile(fid)}
                onDelete={() => deleteProject(project.id)}
                onAddFile={(name, folderId) => handleAddFile(project.id, name, folderId)}
                onAddFolder={(name, parentId) => handleAddFolder(project.id, name, parentId)}
                onDeleteFile={(fid) => deleteFile(fid)}
                onDeleteFolder={(fid) => deleteFolder(fid)}
                onRenameFile={(fid, name) => handleRenameFile(project.id, fid, name)}
                onRenameFolder={(fid, name) => handleRenameFolder(project.id, fid, name)}
              />
            ))}
          </div>
        )}

        {tab === "templates" && (
          <div className="p-2 space-y-1.5">
            {templates.map((tpl) => {
              const deployable = isDeployableTemplate(tpl.id);
              return (
              <button
                key={tpl.id}
                onClick={() => { createProject(tpl.name, tpl.id, tpl.description); setTab("projects"); }}
                className={cn(
                  "w-full text-left p-3 rounded-md border transition-all group",
                  "border-border bg-surface-2 hover:border-border-strong hover:bg-white/3",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-white truncate">{tpl.name}</p>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{tpl.description}</p>
                  </div>
                  <MidnightIcon size={18} />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <TemplateTag difficulty={tpl.difficulty} />
                  <span
                    className={cn(
                      "text-2xs px-1.5 py-0.5 rounded font-medium",
                      deployable ? "text-success bg-success/10" : "text-warning bg-warning/10",
                    )}
                  >
                    {deployable ? "Bundled keys" : "Compile then Deploy"}
                  </span>
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>

    </aside>
  );
}
