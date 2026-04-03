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

function detectLanguage(name: string): ProjectFile["language"] {
  if (name.endsWith(".md") || name.endsWith(".mdx")) return "markdown";
  if (name.endsWith(".json")) return "json";
  return "compact";
}

function AddFileForm({ onAdd, onCancel }: { onAdd: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mx-2 mt-0.5 mb-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md"
        style={{ background: "rgba(240,99,88,0.06)", border: "1px solid rgba(240,99,88,0.2)" }}>
        <FileTypeIcon language={detectLanguage(value)} className="text-text-muted flex-shrink-0" />
        <input value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onAdd(value.trim());
            if (e.key === "Escape") onCancel();
          }}
          placeholder="filename.compact" autoFocus
          className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-dim focus:outline-none min-w-0" />
        <button onClick={() => value.trim() && onAdd(value.trim())}
          className="text-accent hover:opacity-80 transition-opacity flex-shrink-0">
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
    <div className="mx-2 mt-0.5 mb-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md"
        style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)" }}>
        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0 text-info" stroke="currentColor" strokeWidth="1.2">
          <path d="M1 4h4l1 1h5v5H1V4z" strokeLinejoin="round" />
        </svg>
        <input value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onAdd(value.trim());
            if (e.key === "Escape") onCancel();
          }}
          placeholder="folder-name" autoFocus
          className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-dim focus:outline-none min-w-0" />
        <button onClick={() => value.trim() && onAdd(value.trim())}
          className="text-info hover:opacity-80 transition-opacity flex-shrink-0">
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
            <path d="M5 1v8M1 5h8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function FileRow({ file, isActive, canDelete, indent, onClick, onDelete }: {
  file: ProjectFile; isActive: boolean; canDelete: boolean; indent?: boolean;
  onClick: () => void; onDelete: () => void;
}) {
  const iconColor: Record<ProjectFile["language"], string> = {
    compact: isActive ? "text-accent" : "text-text-muted",
    markdown: isActive ? "text-info" : "text-text-muted",
    json: isActive ? "text-warning" : "text-text-muted",
  };
  return (
    <div onClick={onClick} className={cn(
      "group relative flex items-center gap-1.5 pr-2 py-1.5 rounded-md cursor-pointer transition-colors",
      indent ? "pl-10" : "pl-7",
      isActive ? "bg-accent/8" : "hover:bg-white/3"
    )}>
      <span className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
      {indent && <span className="absolute left-7 top-0 bottom-0 w-px bg-border" />}
      <FileTypeIcon language={file.language} className={iconColor[file.language]} />
      <span className={cn("text-xs flex-1 truncate",
        isActive ? "text-accent" : "text-text-secondary group-hover:text-text-primary")}>
        {file.name}
      </span>
      {canDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-error hover:bg-error/10 transition-all flex-shrink-0"
          title="Delete file">
          <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
            <path d="M1 1l6 6M7 1l-6 6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function FolderGroup({ folder, files, isActive, activeFileId, totalFileCount, addingFile,
  onFileClick, onDeleteFile, onDeleteFolder, onStartAddFile, onAddFile, onCancelAddFile }: {
  folder: ProjectFolder; files: ProjectFile[]; isActive: boolean;
  activeFileId: string | null; totalFileCount: number; addingFile: boolean;
  onFileClick: (fileId: string) => void; onDeleteFile: (fileId: string) => void;
  onDeleteFolder: () => void; onStartAddFile: () => void;
  onAddFile: (name: string) => void; onCancelAddFile: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <div className="group relative flex items-center gap-1 pl-6 pr-2 py-1 rounded-md hover:bg-white/2 cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}>
        <span className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
        <svg viewBox="0 0 8 8" fill="currentColor"
          className={cn("w-2 h-2 flex-shrink-0 text-text-dim transition-transform duration-150", !collapsed ? "rotate-90" : "")}>
          <path d="M2 1l4 3-4 3V1z" />
        </svg>
        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0 text-text-muted" stroke="currentColor" strokeWidth="1.2">
          {!collapsed
            ? <path d="M1 3.5h4l1 1h5v5.5H1V3.5z" strokeLinejoin="round" />
            : <path d="M1 4h4l1 1h5v5H1V4z" strokeLinejoin="round" />}
        </svg>
        <span className="text-xs text-text-secondary flex-1 truncate">{folder.name}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => e.stopPropagation()}>
          <button onClick={onStartAddFile}
            className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
            title="Add file to folder">
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-2 h-2">
              <path d="M5 1v8M1 5h8" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={onDeleteFolder}
            className="w-4 h-4 flex items-center justify-center rounded text-text-dim hover:text-error hover:bg-error/10 transition-colors"
            title="Delete folder">
            <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M1 1l6 6M7 1l-6 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
          {files.map((file) => (
            <FileRow key={file.id} file={file}
              isActive={isActive && file.id === activeFileId}
              canDelete={totalFileCount > 1} indent
              onClick={() => onFileClick(file.id)}
              onDelete={() => onDeleteFile(file.id)} />
          ))}
          {addingFile && (
            <div className="pl-3">
              <AddFileForm onAdd={onAddFile} onCancel={onCancelAddFile} />
            </div>
          )}
          {!addingFile && (
            <button onClick={onStartAddFile}
              className="flex items-center gap-1 pl-11 py-0.5 text-2xs text-text-dim hover:text-text-muted rounded transition-colors w-full">
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2 h-2">
                <path d="M4 1v6M1 4h6" strokeLinecap="round" />
              </svg>
              Add file
            </button>
          )}
        </>
      )}
    </div>
  );
}

type AddingState = { type: "none" } | { type: "file"; folderId: string | null } | { type: "folder" };

function ProjectFolder({ project, isActive, isExpanded, activeFileId,
  onToggle, onLoadProject, onSetActiveFile, onDelete,
  onAddFile, onAddFolder, onDeleteFile, onDeleteFolder }: {
  project: Project; isActive: boolean; isExpanded: boolean; activeFileId: string | null;
  onToggle: () => void; onLoadProject: () => void;
  onSetActiveFile: (id: string) => void; onDelete: () => void;
  onAddFile: (name: string, folderId: string | null) => void;
  onAddFolder: (name: string) => void;
  onDeleteFile: (id: string) => void;
  onDeleteFolder: (id: string) => void;
}) {
  const [adding, setAdding] = useState<AddingState>({ type: "none" });
  const [addingFileInFolder, setAddingFileInFolder] = useState<string | null>(null);

  const rootFiles = project.files.filter((f) => !f.folderId);
  const filesByFolder = new Map<string, ProjectFile[]>();
  for (const folder of (project.folders ?? [])) {
    filesByFolder.set(folder.id, project.files.filter((f) => f.folderId === folder.id));
  }

  return (
    <div>
      <div className={cn("group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
        isActive ? "bg-white/4" : "hover:bg-white/3")}>
        <button onClick={onToggle}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
          <svg viewBox="0 0 8 8" fill="currentColor"
            className={cn("w-2 h-2 transition-transform duration-150", isExpanded ? "rotate-90" : "")}>
            <path d="M2 1l4 3-4 3V1z" />
          </svg>
        </button>
        <div onClick={onLoadProject} className="flex items-center gap-1.5 flex-1 min-w-0">
          <svg viewBox="0 0 12 12" fill="none"
            className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-accent" : "text-text-muted")}
            stroke="currentColor" strokeWidth="1.2">
            {isExpanded
              ? <path d="M1 3.5h4l1 1h5v5.5H1V3.5z" strokeLinejoin="round" />
              : <path d="M1 4h4l1 1h5v5H1V4z" strokeLinejoin="round" />}
          </svg>
          <span className={cn("text-sm truncate flex-1 min-w-0",
            isActive ? "text-text-primary font-medium" : "text-text-secondary group-hover:text-text-primary")}>
            {project.name}
          </span>
        </div>
        {!isExpanded && (
          <span className="text-2xs text-text-dim flex-shrink-0 group-hover:hidden">
            {formatRelativeTime(project.updatedAt)}
          </span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setAdding({ type: "file", folderId: null }); }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
            title="New file">
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M5.5 1H2.5a1 1 0 00-1 1v6a1 1 0 001 1h5a1 1 0 001-1V4L5.5 1z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 1v3h3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 4.5v2.5M3.5 6H6.5" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); setAdding({ type: "folder" }); }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-text-secondary hover:bg-white/6 transition-colors"
            title="New folder">
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M1 3h3l1 1h4v4.5H1V3z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 5v2M4 6h2" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-5 h-5 flex items-center justify-center rounded text-text-dim hover:text-error hover:bg-error/10 transition-colors"
            title="Delete project">
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2.5 h-2.5">
              <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mb-1">
          {rootFiles.map((file) => (
            <FileRow key={file.id} file={file}
              isActive={isActive && file.id === activeFileId}
              canDelete={project.files.length > 1}
              onClick={() => { if (!isActive) onLoadProject(); onSetActiveFile(file.id); }}
              onDelete={() => onDeleteFile(file.id)} />
          ))}

          {(project.folders ?? []).map((folder) => (
            <FolderGroup key={folder.id} folder={folder}
              files={filesByFolder.get(folder.id) ?? []}
              isActive={isActive} activeFileId={activeFileId}
              totalFileCount={project.files.length}
              addingFile={addingFileInFolder === folder.id}
              onFileClick={(fileId) => { if (!isActive) onLoadProject(); onSetActiveFile(fileId); }}
              onDeleteFile={(fileId) => onDeleteFile(fileId)}
              onDeleteFolder={() => onDeleteFolder(folder.id)}
              onStartAddFile={() => setAddingFileInFolder(folder.id)}
              onAddFile={(name) => { onAddFile(name, folder.id); setAddingFileInFolder(null); }}
              onCancelAddFile={() => setAddingFileInFolder(null)} />
          ))}

          {adding.type === "file" && adding.folderId === null && (
            <AddFileForm
              onAdd={(name) => { onAddFile(name, null); setAdding({ type: "none" }); }}
              onCancel={() => setAdding({ type: "none" })} />
          )}
          {adding.type === "folder" && (
            <AddFolderForm
              onAdd={(name) => { onAddFolder(name); setAdding({ type: "none" }); }}
              onCancel={() => setAdding({ type: "none" })} />
          )}
          {adding.type === "none" && addingFileInFolder === null && (
            <div className="mx-2 mt-0.5 flex items-center gap-3">
              <button onClick={() => setAdding({ type: "file", folderId: null })}
                className="flex items-center gap-1 py-0.5 text-2xs text-text-dim hover:text-text-muted rounded transition-colors">
                <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-2 h-2">
                  <path d="M4 1v6M1 4h6" strokeLinecap="round" />
                </svg>
                File
              </button>
              <button onClick={() => setAdding({ type: "folder" })}
                className="flex items-center gap-1 py-0.5 text-2xs text-text-dim hover:text-text-muted rounded transition-colors">
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

type SidebarTab = "projects" | "templates";

export function Sidebar() {
  const [tab, setTab] = useState<SidebarTab>("projects");
  const [closedByUser, setClosedByUser] = useState<Set<string>>(new Set());
  const [openedByUser, setOpenedByUser] = useState<Set<string>>(new Set());

  const {
    projects, activeProjectId, activeFileId,
    loadProject, setActiveFile, addFile, deleteFile, deleteProject,
    addFolder, deleteFolder, setNewProjectModalOpen,
  } = useIDEStore();

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

  function handleAddFolder(projectId: string, name: string) {
    if (projectId !== activeProjectId) loadProject(projectId);
    addFolder(name);
  }

  const templates = Object.entries(COMPACT_TEMPLATES).map(([id, t]) => ({
    id, name: t.name, description: t.description,
  }));

  return (
    <aside className="flex flex-col bg-surface border-r border-border h-full w-full overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex gap-0.5">
          <button onClick={() => setTab("projects")}
            className={cn("text-sm font-medium px-2.5 py-1 rounded transition-colors",
              tab === "projects" ? "bg-white/6 text-text-primary" : "text-text-secondary hover:text-text-primary")}>
            Projects
          </button>
          <button onClick={() => setTab("templates")}
            className={cn("text-sm font-medium px-2.5 py-1 rounded transition-colors",
              tab === "templates" ? "bg-white/6 text-text-primary" : "text-text-secondary hover:text-text-primary")}>
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

      <div className="flex-1 overflow-y-auto">
        {tab === "projects" && (
          <div className="p-2 space-y-0.5">
            {projects.length === 0 && (
              <div className="text-center py-10 px-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5 text-text-muted" stroke="currentColor" strokeWidth="1.2">
                    <path d="M2 4h5l1.5 1.5H14V13H2V4z" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted">No projects yet</p>
                <p className="text-xs text-text-dim mt-1 mb-3">Create your first Compact contract</p>
                <button onClick={() => setNewProjectModalOpen(true, "blank")} className="text-xs text-accent hover:underline">
                  + New project
                </button>
              </div>
            )}
            {projects.map((project) => (
              <ProjectFolder key={project.id} project={project}
                isActive={project.id === activeProjectId}
                isExpanded={isExpanded(project.id)}
                activeFileId={project.id === activeProjectId ? activeFileId : null}
                onToggle={() => toggleExpand(project.id)}
                onLoadProject={() => handleLoadProject(project.id)}
                onSetActiveFile={(fid) => setActiveFile(fid)}
                onDelete={() => deleteProject(project.id)}
                onAddFile={(name, folderId) => handleAddFile(project.id, name, folderId)}
                onAddFolder={(name) => handleAddFolder(project.id, name)}
                onDeleteFile={(fid) => deleteFile(fid)}
                onDeleteFolder={(fid) => deleteFolder(fid)} />
            ))}
          </div>
        )}

        {tab === "templates" && (
          <div className="p-2 space-y-1.5">
            {templates.map((tpl) => (
              <button key={tpl.id}
                onClick={() => { setNewProjectModalOpen(true, tpl.id); setTab("projects"); }}
                className={cn("w-full text-left p-3 rounded-md border transition-all group",
                  "border-border bg-surface-2 hover:border-border-strong hover:bg-white/3")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-white truncate">{tpl.name}</p>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{tpl.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-text-dim group-hover:text-text-muted flex-shrink-0 mt-0.5 transition-colors"
                    viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M4 2h4l2 2v6H2V2h2z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 2v2h4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="mt-2"><TemplateTag id={tpl.id} /></div>
              </button>
            ))}
          </div>
        )}
      </div>

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
