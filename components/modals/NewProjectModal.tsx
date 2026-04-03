"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIDEStore } from "@/store/ide";
import { COMPACT_TEMPLATES } from "@/lib/constants";
import { cn, slugify } from "@/lib/utils";

// ─── Template metadata ─────────────────────────────────────────────────────────

const TEMPLATE_META: Record<string, { icon: React.ReactNode; tag: string; tagColor: string }> = {
  "hello-world": {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <path d="M10 3C6.13 3 3 6.13 3 10s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z" />
        <path d="M7 10h6M10 7v6" strokeLinecap="round" />
      </svg>
    ),
    tag: "Beginner",
    tagColor: "text-success bg-success/12",
  },
  counter: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 7v3l2 2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 3.5A7 7 0 0 1 17 10" strokeLinecap="round" />
      </svg>
    ),
    tag: "Beginner",
    tagColor: "text-success bg-success/12",
  },
  voting: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <path d="M4 4h12v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" strokeLinejoin="round" />
        <path d="M4 4l1.5-2h9L16 4" strokeLinejoin="round" />
        <path d="M8 9l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    tag: "Beginner",
    tagColor: "text-success bg-success/12",
  },
  "bulletin-board": {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <rect x="3" y="3" width="14" height="14" rx="1" />
        <path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" />
      </svg>
    ),
    tag: "Beginner+",
    tagColor: "text-success bg-success/12",
  },
  owned: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <path d="M10 3l1.5 3.5L15 7l-2.5 2.5.5 3.5L10 11.5 7 13l.5-3.5L5 7l3.5-.5L10 3z" strokeLinejoin="round" />
      </svg>
    ),
    tag: "Beginner+",
    tagColor: "text-success bg-success/12",
  },
  token: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6v8M8 8.5h3a1.5 1.5 0 010 3H8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    tag: "Intermediate",
    tagColor: "text-warning bg-warning/12",
  },
  registry: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
        <path d="M7 7h6M7 10h6M7 13h3" strokeLinecap="round" />
      </svg>
    ),
    tag: "Intermediate",
    tagColor: "text-warning bg-warning/12",
  },
  profile: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <circle cx="10" cy="7" r="3" />
        <path d="M4 17c0-3.31 2.69-6 6-6s6 2.69 6 6" strokeLinecap="round" />
      </svg>
    ),
    tag: "Intermediate",
    tagColor: "text-warning bg-warning/12",
  },
  escrow: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <path d="M3 10h14M10 3v14" strokeLinecap="round" />
        <circle cx="10" cy="10" r="7" />
      </svg>
    ),
    tag: "Intermediate",
    tagColor: "text-warning bg-warning/12",
  },
  commitment: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <path d="M10 3l7 4v6l-7 4-7-4V7l7-4z" strokeLinejoin="round" />
        <path d="M10 3v14M3 7l7 4 7-4" strokeLinejoin="round" />
      </svg>
    ),
    tag: "Advanced",
    tagColor: "text-error bg-error/12",
  },
  blank: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.3">
        <path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinejoin="round" />
        <path d="M12 3v4h4" strokeLinejoin="round" />
      </svg>
    ),
    tag: "Empty",
    tagColor: "text-text-muted bg-white/5",
  },
};

// ─── File badge icon ───────────────────────────────────────────────────────────

function FileIcon({ language }: { language: string }) {
  if (language === "compact") {
    return (
      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0" stroke="currentColor" strokeWidth="1.2">
        <path d="M6 1L2 3v4l4 2 4-2V3L6 1z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (language === "markdown") {
    return (
      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0" stroke="currentColor" strokeWidth="1.2">
        <path d="M1 2h10v8H1z" strokeLinejoin="round" />
        <path d="M3 8V5l2 2 2-2v3M9 8V5l-1 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 flex-shrink-0" stroke="currentColor" strokeWidth="1.2">
      <path d="M2 2h8v8H2z" strokeLinejoin="round" />
      <path d="M4 5l1.5 1.5L4 8M7 8h2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Modal content (mounts fresh every time modal opens) ──────────────────────

function ModalContent({ initialTemplate, onClose }: { initialTemplate: string; onClose: () => void }) {
  const { createProject } = useIDEStore();
  // State initialises from props at mount time — no syncing effect needed
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus on mount — does not call setState, safe to use in effect
  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, []);

  const slugPreview = name.trim() ? slugify(name.trim()) : "my-project";
  const templates = Object.entries(COMPACT_TEMPLATES);
  const selectedFiles =
    COMPACT_TEMPLATES[selectedTemplate as keyof typeof COMPACT_TEMPLATES]?.files ?? [];

  function handleCreate() {
    if (!name.trim()) return;
    createProject(name.trim(), selectedTemplate, description.trim());
  }

  return (
    <>
      {/* Accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: "linear-gradient(90deg, transparent, #F06358 40%, #f5786d 60%, transparent)" }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(240,99,88,0.15)", border: "1px solid rgba(240,99,88,0.3)" }}
          >
            <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5" stroke="#F06358" strokeWidth="1.4">
              <path d="M7 1L2 3.5v5L7 11l5-2.5v-5L7 1z" strokeLinejoin="round" />
              <circle cx="7" cy="6" r="1.5" fill="#F06358" stroke="none" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary leading-none">New Project</h2>
            <p className="text-xs text-text-muted mt-0.5">Creates a scoped folder with your contract files</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-white/6 transition-colors"
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3 h-3">
            <path d="M1 1l8 8M9 1l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Project Name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="My Midnight Contract"
            className="w-full rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:outline-none transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(240,99,88,0.45)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
          {/* Folder preview */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-text-muted flex-shrink-0" stroke="currentColor" strokeWidth="1.2">
              <path d="M1 3.5h4l1 1h5v5.5H1V3.5z" strokeLinejoin="round" />
            </svg>
            <span className="font-mono text-xs text-text-muted">~/compactlab/</span>
            <span className="font-mono text-xs" style={{ color: name.trim() ? "#F06358" : "#636360" }}>
              {slugPreview}/
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Description</label>
            <span className="text-2xs text-text-dim px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
              optional
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this contract do?"
            rows={2}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:outline-none transition-colors resize-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(240,99,88,0.45)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>

        {/* Template grid */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Template</label>
          <div className="grid grid-cols-2 gap-2">
            {templates.map(([id, tpl]) => {
              const meta = TEMPLATE_META[id];
              const isSelected = selectedTemplate === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedTemplate(id)}
                  className={cn(
                    "relative text-left p-3.5 rounded-xl border transition-all group",
                    isSelected ? "border-accent/40" : "border-transparent hover:border-white/8"
                  )}
                  style={{ background: isSelected ? "rgba(240,99,88,0.07)" : "rgba(255,255,255,0.03)" }}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-colors",
                      isSelected ? "text-accent" : "text-text-muted group-hover:text-text-secondary"
                    )}
                    style={{ background: isSelected ? "rgba(240,99,88,0.15)" : "rgba(255,255,255,0.05)" }}
                  >
                    {meta?.icon}
                  </div>
                  <p className={cn("text-sm font-medium leading-none mb-1", isSelected ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary")}>
                    {tpl.name}
                  </p>
                  <p className="text-2xs text-text-muted leading-relaxed line-clamp-2">{tpl.description}</p>
                  <div className="mt-2.5">
                    <span className={cn("text-2xs font-medium px-1.5 py-0.5 rounded-sm", meta?.tagColor ?? "text-text-muted bg-white/5")}>
                      {meta?.tag}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#F06358" }}>
                      <svg viewBox="0 0 8 8" fill="none" className="w-2.5 h-2.5" stroke="white" strokeWidth="1.5">
                        <path d="M1.5 4l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Files preview */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Files included · {selectedFiles.length}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {selectedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className={cn(
                  f.language === "compact" ? "text-accent" :
                  f.language === "markdown" ? "text-info" : "text-warning"
                )}>
                  <FileIcon language={f.language} />
                </span>
                <span className="font-mono text-xs text-text-secondary">{f.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all",
            name.trim() ? "text-white hover:opacity-90 active:scale-[0.98]" : "opacity-40 cursor-not-allowed text-white"
          )}
          style={{
            background: "linear-gradient(135deg, #F06358, #f5786d)",
            boxShadow: name.trim() ? "0 4px 16px rgba(240,99,88,0.35)" : "none",
          }}
        >
          <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
          Create Project
        </button>
      </div>
    </>
  );
}

// ─── Outer shell — only handles backdrop & close ───────────────────────────────

export function NewProjectModal() {
  const { isNewProjectModalOpen, newProjectModalTemplate, setNewProjectModalOpen } = useIDEStore();

  const handleClose = useCallback(() => {
    setNewProjectModalOpen(false);
  }, [setNewProjectModalOpen]);

  // Escape key listener — no setState, only closes modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    if (isNewProjectModalOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNewProjectModalOpen, handleClose]);

  return (
    <AnimatePresence>
      {isNewProjectModalOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
          onClick={handleClose}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="relative w-full max-w-[560px] max-h-[88vh] flex flex-col overflow-hidden rounded-2xl"
            style={{
              background: "#131313",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(240,99,88,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ModalContent mounts fresh each time — state init is correct from the start */}
            <ModalContent initialTemplate={newProjectModalTemplate} onClose={handleClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
