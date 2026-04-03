"use client";

import { useState } from "react";
import { useIDEStore } from "@/store/ide";
import { Button, Divider, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { COMPACT_TEMPLATES } from "@/lib/constants";

type SidebarTab = "projects" | "templates";

export function Sidebar() {
  const [tab, setTab] = useState<SidebarTab>("projects");
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("blank");

  const { projects, activeProjectId, loadProject, createProject, deleteProject } = useIDEStore();

  const handleCreate = () => {
    if (!newProjectName.trim()) return;
    createProject(newProjectName.trim(), selectedTemplate);
    setNewProjectName("");
    setShowNewForm(false);
    setSelectedTemplate("blank");
    setTab("projects");
  };

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
              tab === "projects"
                ? "bg-white/6 text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            Projects
          </button>
          <button
            onClick={() => setTab("templates")}
            className={cn(
              "text-sm font-medium px-2.5 py-1 rounded transition-colors",
              tab === "templates"
                ? "bg-white/6 text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            Templates
          </button>
        </div>

        {tab === "projects" && (
          <IconButton
            size="sm"
            title="New project"
            onClick={() => setShowNewForm((v) => !v)}
            active={showNewForm}
          >
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
            {/* New project form */}
            {showNewForm && (
              <div className="mb-2 p-2.5 bg-white/3 border border-border rounded-md space-y-2">
                <p className="text-xs text-text-muted font-medium uppercase tracking-wide">New Project</p>
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Project name..."
                  className="w-full bg-white/5 border border-border rounded px-2 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                  autoFocus
                />
                <div className="space-y-1">
                  <p className="text-xs text-text-muted">Template</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(COMPACT_TEMPLATES).map(([id, t]) => (
                      <button
                        key={id}
                        onClick={() => setSelectedTemplate(id)}
                        className={cn(
                          "text-left px-2 py-1.5 rounded text-xs border transition-colors",
                          selectedTemplate === id
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
                        )}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="accent" onClick={handleCreate} className="flex-1">
                    Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Project list */}
            {projects.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-text-muted">No projects yet</p>
                <p className="text-xs text-text-dim mt-1">Create a new project to get started</p>
              </div>
            )}

            {projects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                onLoad={() => loadProject(project.id)}
                onDelete={() => deleteProject(project.id)}
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
                  setSelectedTemplate(tpl.id);
                  setTab("projects");
                  setShowNewForm(true);
                  setNewProjectName(tpl.name);
                }}
                className={cn(
                  "w-full text-left p-3 rounded-md border transition-all group",
                  "border-border bg-surface-2 hover:border-border-strong hover:bg-white/3"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-white truncate">
                      {tpl.name}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-text-dim group-hover:text-text-muted flex-shrink-0 mt-0.5 transition-colors"
                    viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"
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

// Captured once at module load — stable relative-time baseline (no render-time impure calls)
const _MODULE_NOW = Date.now();

function formatRelativeTime(ts: number, now: number): string {
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function ProjectItem({
  project,
  isActive,
  onLoad,
  onDelete,
}: {
  project: { id: string; name: string; updatedAt: number; template?: string };
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  // Capture render-time once — stable for the duration of this render
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer group transition-colors relative",
        isActive
          ? "bg-accent/10 border border-accent/20"
          : "bg-transparent hover:bg-white/4 border border-transparent"
      )}
      onClick={onLoad}
    >
      {/* File icon */}
      <div className={cn(
        "flex-shrink-0 w-6 h-6 rounded flex items-center justify-center",
        isActive ? "bg-accent/20" : "bg-white/6"
      )}>
        <svg className={cn("w-3.5 h-3.5", isActive ? "text-accent" : "text-text-muted")} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M7 1H3a1 1 0 00-1 1v8a1 1 0 001 1h6a1 1 0 001-1V4L7 1z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 1v3h3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 6h4M4 8h2" strokeLinecap="round" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"
        )}>
          {project.name}
        </p>
        <p className="text-2xs text-text-muted mt-0.5">{formatRelativeTime(project.updatedAt, _MODULE_NOW)}</p>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-error hover:bg-error/10 transition-all flex-shrink-0"
        title="Delete project"
      >
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3 h-3">
          <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
