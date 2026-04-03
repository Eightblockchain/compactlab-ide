import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId, slugify } from "@/lib/utils";
import { COMPACT_TEMPLATES, SAMPLE_PROJECTS } from "@/lib/constants";
import type { CompileResult, SimulateResult, DeployResult, LogEntry } from "@/lib/compact";

export type IDEStatus = "idle" | "compiling" | "simulating" | "deploying" | "saving";
export type PanelTab = "simulation" | "privacy" | "contract-ui";
export type LogTab = "logs" | "compile" | "network";

// ─── Domain types ──────────────────────────────────────────────────────────────

export interface ProjectFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface ProjectFile {
  id: string;
  name: string;
  language: "compact" | "markdown" | "json";
  content: string;
  folderId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  template: string;
  folders: ProjectFolder[];
  files: ProjectFile[];
  activeFileId: string;
  createdAt: number;
  updatedAt: number;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  balance: string | null;
  network: string;
}

// ─── Store interface ───────────────────────────────────────────────────────────

export interface IDEStore {
  // Projects
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  activeFileId: string | null;
  activeFile: ProjectFile | null;

  // Editor
  code: string;
  isDirty: boolean;
  saveStatus: "saved" | "saving" | "unsaved";

  // IDE status
  status: IDEStatus;
  activeSteps: string[];

  // Wallet
  wallet: WalletState;

  // Results
  compileResult: CompileResult | null;
  simulateResult: SimulateResult | null;
  simulateInputs: Record<string, string>;
  activeCircuit: string | null;
  deployResult: DeployResult | null;

  // Logs & panels
  logs: LogEntry[];
  logTab: LogTab;
  rightPanelTab: PanelTab;
  bottomPanelOpen: boolean;
  sidebarOpen: boolean;

  // Modal
  isNewProjectModalOpen: boolean;
  newProjectModalTemplate: string;

  // Open editor tabs (file IDs, current project)
  openTabIds: string[];
  // In-memory buffers for unsaved content per file (not persisted)
  tabBuffers: Record<string, string>;

  // Actions — projects
  createProject: (name: string, template?: string, description?: string) => Project;
  loadProject: (id: string) => void;
  setActiveFile: (fileId: string) => void;
  openTab: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  addFile: (name: string, language?: ProjectFile["language"], folderId?: string | null) => ProjectFile | null;
  deleteFile: (fileId: string) => void;
  addFolder: (name: string, parentId?: string | null) => ProjectFolder | null;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, name: string) => void;
  setCode: (code: string) => void;
  saveProject: () => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;

  // Actions — IDE
  setStatus: (status: IDEStatus) => void;
  setCompileResult: (result: CompileResult | null) => void;
  setSimulateResult: (result: SimulateResult | null) => void;
  setDeployResult: (result: DeployResult | null) => void;
  setSimulateInputs: (inputs: Record<string, string>) => void;
  setActiveCircuit: (circuit: string | null) => void;

  // Actions — logs
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;

  // Actions — wallet
  connectWallet: () => void;
  disconnectWallet: () => void;

  // Actions — UI
  setRightPanelTab: (tab: PanelTab) => void;
  setLogTab: (tab: LogTab) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setNewProjectModalOpen: (open: boolean, template?: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildProject(
  id: string,
  name: string,
  template: string,
  description: string,
  createdAt: number,
  updatedAt: number
): Project {
  const tpl =
    COMPACT_TEMPLATES[template as keyof typeof COMPACT_TEMPLATES] ??
    COMPACT_TEMPLATES.blank;
  const files: ProjectFile[] = tpl.files.map((f) => ({
    id: generateId(),
    name: f.name,
    language: f.language,
    content: f.content,
    createdAt,
    updatedAt,
  }));
  return {
    id,
    name,
    slug: slugify(name),
    description,
    template,
    folders: [],
    files,
    activeFileId: files[0]?.id ?? "",
    createdAt,
    updatedAt,
  };
}

const INITIAL_PROJECTS: Project[] = SAMPLE_PROJECTS.map((p) =>
  buildProject(
    p.id,
    p.name,
    p.template,
    p.description,
    p.updatedAt - 1000 * 60 * 60,
    p.updatedAt
  )
);

const firstProject = INITIAL_PROJECTS[0] ?? null;
const firstFile = firstProject
  ? (firstProject.files.find((f) => f.id === firstProject.activeFileId) ??
      firstProject.files[0] ??
      null)
  : null;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useIDEStore = create<IDEStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      projects: INITIAL_PROJECTS,
      activeProjectId: firstProject?.id ?? null,
      activeProject: firstProject,
      activeFileId: firstFile?.id ?? null,
      activeFile: firstFile,

      code: firstFile?.content ?? "",
      isDirty: false,
      saveStatus: "saved",

      status: "idle",
      activeSteps: [],

      wallet: {
        connected: false,
        address: null,
        balance: null,
        network: "Midnight Devnet",
      },

      compileResult: null,
      simulateResult: null,
      simulateInputs: {},
      activeCircuit: null,
      deployResult: null,

      logs: [],
      rightPanelTab: "simulation",
      logTab: "logs",
      bottomPanelOpen: true,
      sidebarOpen: true,

      isNewProjectModalOpen: false,
      newProjectModalTemplate: "blank",

      openTabIds: firstFile ? [firstFile.id] : [],
      tabBuffers: {},

      // ── Project actions ────────────────────────────────────────────────────

      createProject: (name, template = "blank", description = "") => {
        const now = Date.now();
        const project = buildProject(
          generateId(),
          name,
          template,
          description,
          now,
          now
        );
        const file =
          project.files.find((f) => f.id === project.activeFileId) ??
          project.files[0] ??
          null;
        set((state) => ({
          projects: [project, ...state.projects],
          activeProjectId: project.id,
          activeProject: project,
          activeFileId: file?.id ?? null,
          activeFile: file,
          code: file?.content ?? "",
          isDirty: false,
          saveStatus: "saved",
          compileResult: null,
          simulateResult: null,
          deployResult: null,
          isNewProjectModalOpen: false,
          openTabIds: file ? [file.id] : [],
          tabBuffers: {},
        }));
        return project;
      },

      loadProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        if (!project) return;
        const file =
          project.files.find((f) => f.id === project.activeFileId) ??
          project.files[0] ??
          null;
        set({
          activeProjectId: id,
          activeProject: project,
          activeFileId: file?.id ?? null,
          activeFile: file,
          code: file?.content ?? "",
          isDirty: false,
          saveStatus: "saved",
          compileResult: null,
          simulateResult: null,
          deployResult: null,
          logs: [],
          openTabIds: file ? [file.id] : [],
          tabBuffers: {},
        });
      },

      setActiveFile: (fileId) => {
        get().openTab(fileId);
      },

      openTab: (fileId) => {
        const { activeProject, activeProjectId, activeFileId, code, openTabIds, tabBuffers, projects } = get();
        if (!activeProject) return;
        // Already on this file and it's open — nothing to do
        if (fileId === activeFileId && openTabIds.includes(fileId)) return;

        const file = activeProject.files.find((f) => f.id === fileId);
        if (!file) return;

        // 1. Flush current code into buffer and into the file
        const newBuffers: Record<string, string> = { ...tabBuffers };
        let updatedProject = activeProject;
        if (activeFileId && activeFileId !== fileId) {
          newBuffers[activeFileId] = code;
          updatedProject = {
            ...activeProject,
            files: activeProject.files.map((f) =>
              f.id === activeFileId ? { ...f, content: code, updatedAt: Date.now() } : f
            ),
            activeFileId: fileId,
          };
        } else {
          updatedProject = { ...activeProject, activeFileId: fileId };
        }

        // 2. Add to tab strip if not already open
        const newTabs = openTabIds.includes(fileId) ? openTabIds : [...openTabIds, fileId];

        // 3. Load content: prefer buffer, then file content
        const newCode = newBuffers[fileId] ?? file.content;

        set({
          openTabIds: newTabs,
          tabBuffers: newBuffers,
          activeProjectId,
          activeProject: updatedProject,
          projects: projects.map((p) => p.id === activeProjectId ? updatedProject : p),
          activeFileId: fileId,
          activeFile: { ...file, content: newCode },
          code: newCode,
          isDirty: false,
          saveStatus: "saved",
        });
      },

      closeTab: (fileId) => {
        const { openTabIds, activeFileId, activeProject, activeProjectId, projects, tabBuffers, code } = get();
        const newTabs = openTabIds.filter((id) => id !== fileId);
        const newBuffers = { ...tabBuffers };
        delete newBuffers[fileId];

        if (fileId !== activeFileId) {
          // Closing an inactive tab — just remove it
          set({ openTabIds: newTabs, tabBuffers: newBuffers });
          return;
        }

        // Closing the active tab — find the best adjacent tab to activate
        const idx = openTabIds.indexOf(fileId);
        // Prefer the tab to the left, then right
        const nextId = newTabs[idx - 1] ?? newTabs[idx] ?? null;

        if (!nextId || !activeProject) {
          set({ openTabIds: newTabs, tabBuffers: newBuffers, activeFileId: null, activeFile: null, code: "" });
          return;
        }

        const nextFile = activeProject.files.find((f) => f.id === nextId) ?? null;
        const nextCode = newBuffers[nextId] ?? nextFile?.content ?? "";

        // Also flush current code to the file being closed before leaving
        let updatedProject = activeProject;
        if (activeFileId) {
          updatedProject = {
            ...activeProject,
            files: activeProject.files.map((f) =>
              f.id === activeFileId ? { ...f, content: code, updatedAt: Date.now() } : f
            ),
            activeFileId: nextId,
          };
        }

        set({
          openTabIds: newTabs,
          tabBuffers: newBuffers,
          activeProject: updatedProject,
          projects: projects.map((p) => p.id === activeProjectId ? updatedProject : p),
          activeFileId: nextId,
          activeFile: nextFile,
          code: nextCode,
          isDirty: false,
          saveStatus: "saved",
        });
      },

      addFolder: (name, parentId = null) => {
        const { activeProjectId, activeProject, projects } = get();
        if (!activeProjectId || !activeProject) return null;
        const folder: ProjectFolder = { id: generateId(), name, parentId, createdAt: Date.now() };
        const updated: Project = {
          ...activeProject,
          folders: [...(activeProject.folders ?? []), folder],
          updatedAt: Date.now(),
        };
        set({
          projects: projects.map((p) => p.id === activeProjectId ? updated : p),
          activeProject: updated,
        });
        return folder;
      },

      deleteFolder: (folderId) => {
        const { activeProjectId, activeProject, projects } = get();
        if (!activeProjectId || !activeProject) return;
        // Collect all descendant folder IDs recursively
        const allFolders = activeProject.folders ?? [];
        const toDelete = new Set<string>();
        const collect = (id: string) => {
          toDelete.add(id);
          allFolders.forEach((f) => { if (f.parentId === id) collect(f.id); });
        };
        collect(folderId);
        // Move affected files to root, remove all deleted folders
        const updated: Project = {
          ...activeProject,
          folders: allFolders.filter((f) => !toDelete.has(f.id)),
          files: activeProject.files.map((f) =>
            f.folderId && toDelete.has(f.folderId) ? { ...f, folderId: null } : f
          ),
          updatedAt: Date.now(),
        };
        set({
          projects: projects.map((p) => p.id === activeProjectId ? updated : p),
          activeProject: updated,
        });
      },

      renameFolder: (folderId, name) => {
        const { activeProjectId, activeProject, projects } = get();
        if (!activeProjectId || !activeProject) return;
        const updated: Project = {
          ...activeProject,
          folders: activeProject.folders.map((f) => f.id === folderId ? { ...f, name } : f),
          updatedAt: Date.now(),
        };
        set({
          projects: projects.map((p) => p.id === activeProjectId ? updated : p),
          activeProject: updated,
        });
      },

      addFile: (name, language = "compact", folderId = null) => {
        const { activeProjectId, activeProject, projects, openTabIds, tabBuffers, activeFileId, code } = get();
        if (!activeProjectId || !activeProject) return null;

        const defaultContent: Record<ProjectFile["language"], string> = {
          compact: `// ${name}\n\n// Add your circuits here\n`,
          markdown: `# ${name.replace(/\.md$/, "")}\n`,
          json: `{\n}\n`,
        };

        const file: ProjectFile = {
          id: generateId(),
          name,
          language,
          content: defaultContent[language],
          folderId: folderId ?? null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Flush current content to buffer before switching
        const newBuffers = activeFileId
          ? { ...tabBuffers, [activeFileId]: code }
          : { ...tabBuffers };

        const updated: Project = {
          ...activeProject,
          files: [...activeProject.files, file],
          activeFileId: file.id,
          updatedAt: Date.now(),
        };

        set({
          projects: projects.map((p) => p.id === activeProjectId ? updated : p),
          activeProject: updated,
          activeFileId: file.id,
          activeFile: file,
          code: file.content,
          openTabIds: [...openTabIds, file.id],
          tabBuffers: newBuffers,
          isDirty: false,
          saveStatus: "saved",
        });

        return file;
      },

      deleteFile: (fileId) => {
        const { activeProjectId, activeProject, activeFileId, projects, openTabIds, tabBuffers } = get();
        if (!activeProjectId || !activeProject) return;
        if (activeProject.files.length <= 1) return;

        const updatedFiles = activeProject.files.filter((f) => f.id !== fileId);
        const isActive = fileId === activeFileId;

        // Remove from tabs
        const newTabs = openTabIds.filter((id) => id !== fileId);
        const newBuffers = { ...tabBuffers };
        delete newBuffers[fileId];

        // If deleted file was active, activate adjacent in tab strip
        const tabIdx = openTabIds.indexOf(fileId);
        const nextTabId = newTabs[tabIdx - 1] ?? newTabs[tabIdx] ?? updatedFiles[0]?.id ?? "";
        const newActiveFileId = isActive ? nextTabId : (activeFileId ?? "");
        const newActiveFile = updatedFiles.find((f) => f.id === newActiveFileId) ?? updatedFiles[0];

        const updated: Project = {
          ...activeProject,
          files: updatedFiles,
          activeFileId: newActiveFileId,
          updatedAt: Date.now(),
        };

        set({
          projects: projects.map((p) => p.id === activeProjectId ? updated : p),
          activeProject: updated,
          activeFileId: newActiveFileId,
          activeFile: newActiveFile ?? null,
          openTabIds: newTabs.length > 0 ? newTabs : (newActiveFile ? [newActiveFile.id] : []),
          tabBuffers: newBuffers,
          ...(isActive ? { code: newBuffers[newActiveFileId] ?? newActiveFile?.content ?? "", isDirty: false, saveStatus: "saved" } : {}),
        });
      },

      setCode: (code) => {
        set((s) => ({
          code,
          isDirty: true,
          saveStatus: "unsaved",
          // Keep buffer in sync so tab-switching restores unsaved content
          tabBuffers: s.activeFileId
            ? { ...s.tabBuffers, [s.activeFileId]: code }
            : s.tabBuffers,
        }));
      },

      saveProject: () => {
        const { activeProjectId, activeFileId, code, projects } = get();
        if (!activeProjectId || !activeFileId) return;
        const now = Date.now();
        set({ saveStatus: "saving", isDirty: false });
        setTimeout(() => {
          const updatedProjects = projects.map((p) => {
            if (p.id !== activeProjectId) return p;
            return {
              ...p,
              files: p.files.map((f) =>
                f.id === activeFileId
                  ? { ...f, content: code, updatedAt: now }
                  : f
              ),
              updatedAt: now,
            };
          });
          const updatedProject =
            updatedProjects.find((p) => p.id === activeProjectId) ?? null;
          set({
            projects: updatedProjects,
            activeProject: updatedProject,
            saveStatus: "saved",
          });
        }, 300);
      },

      deleteProject: (id) => {
        const { projects, activeProjectId } = get();
        const filtered = projects.filter((p) => p.id !== id);
        if (id === activeProjectId) {
          const next = filtered[0] ?? null;
          const nextFile = next
            ? (next.files.find((f) => f.id === next.activeFileId) ??
                next.files[0] ??
                null)
            : null;
          set({
            projects: filtered,
            activeProjectId: next?.id ?? null,
            activeProject: next,
            activeFileId: nextFile?.id ?? null,
            activeFile: nextFile,
            code: nextFile?.content ?? "",
          });
        } else {
          set({ projects: filtered });
        }
      },

      renameProject: (id, name) => {
        const s = slugify(name);
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, slug: s } : p
          ),
          activeProject:
            state.activeProject?.id === id
              ? { ...state.activeProject, name, slug: s }
              : state.activeProject,
        }));
      },

      // ── IDE actions ────────────────────────────────────────────────────────
      setStatus: (status) => set({ status }),
      setCompileResult: (compileResult) => set({ compileResult }),
      setSimulateResult: (simulateResult) => set({ simulateResult }),
      setDeployResult: (deployResult) => set({ deployResult }),
      setSimulateInputs: (simulateInputs) => set({ simulateInputs }),
      setActiveCircuit: (activeCircuit) => set({ activeCircuit }),

      addLog: (log) =>
        set((s) => ({ logs: [...s.logs.slice(-500), log] })),
      clearLogs: () => set({ logs: [] }),

      connectWallet: () =>
        set({
          wallet: {
            connected: true,
            address: "0x742d35Cc6634C0532925a3b8D4C9b5A15e8c3a4",
            balance: "12.847 DUST",
            network: "Midnight Devnet",
          },
        }),
      disconnectWallet: () =>
        set({
          wallet: {
            connected: false,
            address: null,
            balance: null,
            network: "Midnight Devnet",
          },
        }),

      setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
      setLogTab: (logTab) => set({ logTab }),
      setBottomPanelOpen: (bottomPanelOpen) => set({ bottomPanelOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setNewProjectModalOpen: (open, template = "blank") =>
        set({ isNewProjectModalOpen: open, newProjectModalTemplate: template }),
    }),
    {
      name: "compactlab-v4",
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        openTabIds: state.openTabIds,
        sidebarOpen: state.sidebarOpen,
        bottomPanelOpen: state.bottomPanelOpen,
        rightPanelTab: state.rightPanelTab,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const proj = state.projects?.find(
          (p) => p.id === state.activeProjectId
        );
        if (proj) {
          const file =
            proj.files?.find((f) => f.id === proj.activeFileId) ??
            proj.files?.[0] ??
            null;
          state.activeProject = proj;
          state.activeFileId = file?.id ?? null;
          state.activeFile = file ?? null;
          state.code = file?.content ?? "";
          // Validate persisted tab IDs still exist in the project
          const validFileIds = new Set(proj.files?.map((f) => f.id) ?? []);
          const restoredTabs = (state.openTabIds ?? []).filter((id) => validFileIds.has(id));
          state.openTabIds = restoredTabs.length > 0 ? restoredTabs : (file ? [file.id] : []);
          state.tabBuffers = {};
        }
      },
    }
  )
);
