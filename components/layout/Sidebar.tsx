"use client";

import { useState } from "react";
import { useIDEStore } from "@/store/ide";
import type { Project, ProjectFile, ProjectFolder } from "@/store/ide";
import { Divider, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { COMPACT_TEMPLATES } from "@/lib/constants";

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

// ─── File icons ────────────────────────────────────────────────────────────────

function CompactIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={cn("w-3 h-3", className)} stroke="currentColor" strokeWidth="1.2">
      <path d="M6 1L2 3v4l4 2 4-2V3L6 1z" strokeLinejoin="round" />
      <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MarkdownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={cn("w-3 h-3", className)} stroke="currentColor" strokeWidth="1.2">
      <path d="M1 2h10v8H1z" strokeLinejoin="round" />
      <path d="M3 8V5l2 2 2-2v3M9 8V5l-1 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function JsonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={cn("w-3 h-3", className)} stroke="currentColor" strokeWidth="1.2">
      <path d="M2 3.5C2 2.7 2.7 2 3.5 2S5 2.7 5 3.5v5C5 9.3 4.3 10 3.5 10" strokeLinecap="round" />
      <path d="M10 3.5C10 2.7 9.3 2 8.5 2S7 2.7 7 3.5v5c0 .8.7 1.5 1.5 1.5" strokeLinecap="round" />
    </svg>
  );
}

function FileTypeIcon({ language, className }: { language: ProjectFile["language"]; className?: string }) {
  if (language === "compact") return <CompactIcon className={className} />;
  if (language === "markdown") return <MarkdownIcon className={className} />;
  return <JsonIcon className={className} />;
}

// ─── Template tag ──────────────────────────────────────────────────────────────

function TemplateTag({ id }: { id: string }) {
  const tags: Record<string, { label: string; color: string }> = {
    counter: { label: "Beginner", color: "text-success bg-success/10" },
    voting: { label: "ZK Proof", color: "text-info bg-info/10" },
    token: { label: "DeFi", color: "text-warning bg-warning/10" },
    blank: { label: "Empty", color: "text-text-muted bg-white/5" },
  };
  const tag = tags[id] ?? { label: id, color: "text-text-muted bg-white/5" };
  return (
    <span className={cn("text-2xs font-medium px-1.5 py-0.5 rounded-sm", tag.color)}>
      {tag.label}
    </span>
  );
}

// ─── Inline forms ──────────────────────────────────────────────────────────────

function detectLanguage(name: string): ProjectFile["language"] {
  if (name.endsWith(".md") || name.endsWith(".mdx")) return "markdown";
  if (name.endsWith(".json")) return "json";
  return "compact";
}

function AddFileForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-0.5 mb-1 mr-2">
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md"
        style={{ background: "rgba(240,99,88,0.06)", border: "1px solid rgba(240,99,88,0.2)" }}
      >
        <FileTypeIcon language={detectLanguage(value)} className="text-text-muted flex-shrink-0" />
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

function AddFolderForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-0.5 mb-1 mr-2">
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md"
        style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)" }}
      >
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className="w-3 h-3 flex-shrink-0 text-info"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path d="M1 4h4l1 1h5v5H1V4z" strokeLinejoin="round" />
        </svg>
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
          className="text-info hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
            <path d="M5 1v8M1 5h8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── File row ──────────────────────────────────────────────────────────────────
// depth controls left padding: 0 => 28px, each level +16px

function FileRow({
  file,
  isActive,
  canDelete,
  depth = 0,
  onClick,
  onDelete,
}: {
  file: ProjectFile;
  isActive: boolean;
  canDelete: boolean;
  depth?: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const pl = 28 + depth * 16;
  const iconColor: Record<ProjectFile["language"], string> = {
    compact: isActive ? "text-accent" : "text-text-muted",
    markdown: isActive ? "text-info" : "text-text-muted",
    json: isActive ? "text-warning" : "text-text-muted",
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-1.5 pr-2 py-1.5 rounded-md cursor-pointer transition-colors",
        isActive ? "bg-accent/8" : "hover:bg-white/3",
      )}
      style={{ paddingLeft: pl }}
    >
      <FileTypeIcon language={file.language} className={iconColor[file.language]} />
      <span
        className={cn(
          "text-xs flex-1 truncate",
          isActive ? "text-accent" : "text-text-secondary group-hover:text-text-primary",
        )}
      >
        {file.name}
      </span>
      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-error hover:bg-error/10 transition-all flex-shrink-0"
          title="Delete file"
        >
          <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
            <path d="M1 1l6 6M7 1l-6 6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Recursive folder node ─────────────────────────────────────────────────────
// Renders a folder, its files, and sub-folders recursively.
// depth 0 = directly inside a project, depth 1 = sub-folder, etc.

function FolderNode({
  folder,
  allFolders,
  allFiles,
  isActive,
  activeFileId,
  totalFileCount,
  depth,
  onFileClick,
  onDeleteFile,
  onDeleteFolder,
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
  onFileClick: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onAddFile: (name: string, folderId: string) => void;
  onAddSubfolder: (name: string, parentId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [nodeAdding, setNodeAdding] = useState<"none" | "file" | "subfolder">("none");

  const directFiles = allFiles.filter((f) => f.folderId === folder.id);
  const subFolders = allFolders.filter((f) => f.parentId === folder.id);

  // Indentation: depth 0 -> paddingLeft 24px, each extra level +16px
  const folderPl = 24 + depth * 16;
  const contentPl = folderPl + 16; // forms+files inside this folder

  function openAndAdd(kind: "file" | "subfolder") {
    setCollapsed(false);
    setNodeAdding(kind);
  }

  return (
    <div>
      {/* Folder header row */}
      <div
        className="group flex items-center gap-1 pr-2 py-1 rounded-md hover:bg-white/3 cursor-pointer transition-colors"
        style={{ paddingLeft: folderPl }}
        onClick={() => setCollapsed((c) => !c)}
      >
        {/* Chevron */}
        <svg
          viewBox="0 0 8 8"
          fill="currentColor"
          className={cn(
            "w-2 h-2 flex-shrink-0 text-text-dim transition-transform duration-150",
            !collapsed ? "rotate-90" : "",
          )}
        >
          <path d="M2 1l4 3-4 3V1z" />
        </svg>

        {/* Folder icon */}
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className="w-3 h-3 flex-shrink-0 text-text-muted"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          {!collapsed ? (
            <path d="M1 3.5h4l1 1h5v5.5H1V3.5z" strokeLinejoin="round" />
          ) : (
            <path d="M1 4h4l1 1h5v5H1V4z" strokeLinejoin="round" />
          )}
        </svg>

        <span className="text-xs text-text-secondary flex-1 truncate">{folder.name}</span>

        {/* Hover actions */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* New file */}
          <button
            onClick={() => openAndAdd("file")}
            className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
            title="New file"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-2 h-2">
              <path d="M5 1v8M1 5h8" strokeLinecap="round" />
            </svg>
          </button>

          {/* New sub-folder */}
          <button
            onClick={() => openAndAdd("subfolder")}
            className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-info hover:bg-info/10 transition-colors"
            title="New sub-folder"
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3 h-3">
              <path d="M1 4h4l1 1h5v5H1V4z" strokeLinejoin="round" />
              <path d="M6 7v2M5 8h2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Delete folder */}
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
      </div>

      {/* Contents */}
      {!collapsed && (
        <div>
          {/* Direct files */}
          {directFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              isActive={isActive && file.id === activeFileId}
              canDelete={totalFileCount > 1}
              depth={depth + 1}
              onClick={() => onFileClick(file.id)}
              onDelete={() => onDeleteFile(file.id)}
            />
          ))}

          {/* Sub-folders (recursive) */}
          {subFolders.map((sub) => (
            <FolderNode
              key={sub.id}
              folder={sub}
              allFolders={allFolders}
              allFiles={allFiles}
              isActive={isActive}
              activeFileId={activeFileId}
              totalFileCount={totalFileCount}
              depth={depth + 1}
              onFileClick={onFileClick}
              onDeleteFile={onDeleteFile}
              onDeleteFolder={onDeleteFolder}
              onAddFile={onAddFile}
              onAddSubfolder={onAddSubfolder}
            />
          ))}

          {/* Inline forms */}
          {nodeAdding === "file" && (
            <div style={{ paddingLeft: contentPl }}>
              <AddFileForm
                onAdd={(name) => {
                  onAddFile(name, folder.id);
                  setNodeAdding("none");
                }}
                onCancel={() => setNodeAdding("none")}
              />
            </div>
          )}
          {nodeAdding === "subfolder" && (
            <div style={{ paddingLeft: folderPl }}>
              <AddFolderForm
                onAdd={(name) => {
                  onAddSubfolder(name, folder.id);
                  setNodeAdding("none");
                }}
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
}) {
  const [rootAdding, setRootAdding] = useState<RootAddingState>({ type: "none" });

  const allFolders = project.folders ?? [];
  const allFiles = project.files;

  // Root-level = no parent folder
  const rootFolders = allFolders.filter((f) => !f.parentId);
  const rootFiles = allFiles.filter((f) => !f.folderId);

  return (
    <div>
      {/* Project header */}
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          isActive ? "bg-white/4" : "hover:bg-white/3",
        )}
      >
        {/* Expand chevron */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        >
          <svg
            viewBox="0 0 8 8"
            fill="currentColor"
            className={cn("w-2 h-2 transition-transform duration-150", isExpanded ? "rotate-90" : "")}
          >
            <path d="M2 1l4 3-4 3V1z" />
          </svg>
        </button>

        {/* Folder icon + project name */}
        <div onClick={onLoadProject} className="flex items-center gap-1.5 flex-1 min-w-0">
          <svg
            viewBox="0 0 12 12"
            fill="none"
            className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-accent" : "text-text-muted")}
            stroke="currentColor"
            strokeWidth="1.2"
          >
            {isExpanded ? (
              <path d="M1 3.5h4l1 1h5v5.5H1V3.5z" strokeLinejoin="round" />
            ) : (
              <path d="M1 4h4l1 1h5v5H1V4z" strokeLinejoin="round" />
            )}
          </svg>
          <span
            className={cn(
              "text-sm truncate flex-1 min-w-0",
              isActive ? "text-text-primary font-medium" : "text-text-secondary group-hover:text-text-primary",
            )}
          >
            {project.name}
          </span>
        </div>

        {!isExpanded && (
          <span className="text-2xs text-text-dim flex-shrink-0 group-hover:hidden">
            {formatRelativeTime(project.updatedAt)}
          </span>
        )}

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {/* New file */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRootAdding({ type: "file" });
            }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
            title="New file"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path
                d="M5.5 1H2.5a1 1 0 00-1 1v6a1 1 0 001 1h5a1 1 0 001-1V4L5.5 1z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M5.5 1v3h3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 4.5v2.5M3.5 6H6.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* New folder */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRootAdding({ type: "folder" });
            }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
            title="New folder"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M1 3h3l1 1h4v4.5H1V3z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 5v2M4 6h2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Delete project */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-error hover:bg-error/10 transition-colors"
            title="Delete project"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded tree */}
      {isExpanded && (
        <div className="mb-1">
          {/* Root-level files */}
          {rootFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              isActive={isActive && file.id === activeFileId}
              canDelete={allFiles.length > 1}
              depth={0}
              onClick={() => {
                if (!isActive) onLoadProject();
                onSetActiveFile(file.id);
              }}
              onDelete={() => onDeleteFile(file.id)}
            />
          ))}

          {/* Root-level folders (each renders recursively) */}
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
              onFileClick={(fileId) => {
                if (!isActive) onLoadProject();
                onSetActiveFile(fileId);
              }}
              onDeleteFile={(fileId) => onDeleteFile(fileId)}
              onDeleteFolder={(folderId) => onDeleteFolder(folderId)}
              onAddFile={(name, folderId) => onAddFile(name, folderId)}
              onAddSubfolder={(name, parentId) => onAddFolder(name, parentId)}
            />
          ))}

          {/* Root-level inline forms */}
          {rootAdding.type === "file" && (
            <div className="pl-7">
              <AddFileForm
                onAdd={(name) => {
                  onAddFile(name, null);
                  setRootAdding({ type: "none" });
                }}
                onCancel={() => setRootAdding({ type: "none" })}
              />
            </div>
          )}
          {rootAdding.type === "folder" && (
            <div className="pl-2">
              <AddFolderForm
                onAdd={(name) => {
                  onAddFolder(name, null);
                  setRootAdding({ type: "none" });
                }}
                onCancel={() => setRootAdding({ type: "none" })}
              />
            </div>
          )}

          {/* Bottom shortcuts (only when no form is open) */}
          {rootAdding.type === "none" && (
            <div className="mx-2 mt-1 flex items-center gap-3">
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
    setNewProjectModalOpen,
  } = useIDEStore();

  function isExpanded(id: string): boolean {
    if (closedByUser.has(id)) return false;
    if (id === activeProjectId) return true;
    return openedByUser.has(id);
  }

  function toggleExpand(id: string) {
    if (isExpanded(id)) {
      setClosedByUser((prev) => new Set([...prev, id]));
      setOpenedByUser((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    } else {
      setOpenedByUser((prev) => new Set([...prev, id]));
      setClosedByUser((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }

  function handleLoadProject(id: string) {
    loadProject(id);
    setClosedByUser((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
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

  const templates = Object.entries(COMPACT_TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
  }));

  return (
    <aside className="flex flex-col bg-surface border-r border-border h-full w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex gap-0.5">
          <button
            onClick={() => setTab("projects")}
            className={cn(
              "text-sm font-medium px-2.5 py-1 rounded transition-colors",
              tab === "projects" ? "bg-white/6 text-text-primary" : "text-text-secondary hover:text-text-primary",
            )}
          >
            Projects
          </button>
          <button
            onClick={() => setTab("templates")}
            className={cn(
              "text-sm font-medium px-2.5 py-1 rounded transition-colors",
              tab === "templates" ? "bg-white/6 text-text-primary" : "text-text-secondary hover:text-text-primary",
            )}
          >
            Templates
          </button>
        </div>
        {tab === "projects" && (
          <IconButton size="sm" title="New project" onClick={() => setNewProjectModalOpen(true, "blank")}>
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </IconButton>
        )}
      </div>

      <Divider />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "projects" && (
          <div className="p-2 space-y-0.5">
            {projects.length === 0 && (
              <div className="text-center py-10 px-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="w-5 h-5 text-text-muted"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  >
                    <path d="M2 4h5l1.5 1.5H14V13H2V4z" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted">No projects yet</p>
                <p className="text-xs text-text-dim mt-1 mb-3">Create your first Compact contract</p>
                <button
                  onClick={() => setNewProjectModalOpen(true, "blank")}
                  className="text-xs text-accent hover:underline"
                >
                  + New project
                </button>
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
              />
            ))}
          </div>
        )}

        {tab === "templates" && (
          <div className="p-2 space-y-1.5">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  setNewProjectModalOpen(true, tpl.id);
                  setTab("projects");
                }}
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
                  <svg
                    className="w-4 h-4 text-text-dim group-hover:text-text-muted flex-shrink-0 mt-0.5 transition-colors"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  >
                    <path d="M4 2h4l2 2v6H2V2h2z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 2v2h4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="mt-2">
                  <TemplateTag id={tpl.id} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-xs text-text-muted">Midnight Devnet</span>
          <span className="ml-auto text-xs text-text-dim">v0.14.0</span>
        </div>
      </div>
    </aside>
  );
}
