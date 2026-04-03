import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId, slugify } from "@/lib/utils";
import { COMPACT_TEMPLATES, SAMPLE_PROJECTS } from "@/lib/constants";
import type { CompileResult, SimulateResult, DeployResult, LogEntry } from "@/lib/compact";

export type IDEStatus = "idle" | "compiling" | "simulating" | "deploying" | "saving";
export type PanelTab = "simulation" | "privacy" | "contract-ui";
export type LogTab = "logs" | "compile" | "network";

// ─── Domain types ──────────────────────────────────────────────────────────────

export interface ProjectFile {
  id: string;
  name: string;
  language: "compact" | "markdown" | "json";
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  template: string;
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

  // Actions — projects
  createProject: (name: string, template?: string, description?: string) => Project;
  loadProject: (id: string) => void;
  setActiveFile: (fileId: string) => void;
  addFile: (name: string, language?: ProjectFile["language"]) => ProjectFile | null;
  deleteFile: (fileId: string) => void;
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
        });
      },

      setActiveFile: (fileId) => {
        const { activeProject, activeProjectId, activeFileId, code, projects } =
          get();
        if (!activeProject || fileId === activeFileId) return;

        // Flush current code into the current file before switching
        let base = activeProject;
        if (activeFileId) {
          base = {
            ...activeProject,
            files: activeProject.files.map((f) =>
              f.id === activeFileId
                ? { ...f, content: code, updatedAt: Date.now() }
                : f
            ),
          };
        }

        const file = base.files.find((f) => f.id === fileId);
        if (!file) return;

        const updated = { ...base, activeFileId: fileId };
        set({
          projects: projects.map((p) =>
            p.id === activeProjectId ? updated : p
          ),
          activeProject: updated,
          activeFileId: fileId,
          activeFile: file,
          code: file.content,
          isDirty: false,
          saveStatus: "saved",
        });
      },

      addFile: (name, language = "compact") => {
        const { activeProjectId, activeProject, projects } = get();
        if (!activeProjectId || !activeProject) return null;

        const defaultContent: Record<ProjectFile["language"], string> = {
          compact: `// ${name}\n\n// Add your types and circuits here\n`,
          markdown: `# ${name.replace(/\.md$/, "")}\n`,
          json: `{\n}\n`,
        };

        const file: ProjectFile = {
          id: generateId(),
          name,
          language,
          content: defaultContent[language],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const updated: Project = {
          ...activeProject,
          files: [...activeProject.files, file],
          activeFileId: file.id,
          updatedAt: Date.now(),
        };

        set({
          projects: projects.map((p) =>
            p.id === activeProjectId ? updated : p
          ),
          activeProject: updated,
          activeFileId: file.id,
          activeFile: file,
          code: file.content,
        });

        return file;
      },

      deleteFile: (fileId) => {
        const { activeProjectId, activeProject, activeFileId, projects } = get();
        if (!activeProjectId || !activeProject) return;
        if (activeProject.files.length <= 1) return;

        const updatedFiles = activeProject.files.filter((f) => f.id !== fileId);
        const isActive = fileId === activeFileId;
        const newActiveFileId = isActive
          ? (updatedFiles[0]?.id ?? "")
          : (activeFileId ?? "");
        const newActiveFile =
          updatedFiles.find((f) => f.id === newActiveFileId) ?? updatedFiles[0];

        const updated: Project = {
          ...activeProject,
          files: updatedFiles,
          activeFileId: newActiveFileId,
          updatedAt: Date.now(),
        };

        set({
          projects: projects.map((p) =>
            p.id === activeProjectId ? updated : p
          ),
          activeProject: updated,
          activeFileId: newActiveFileId,
          activeFile: newActiveFile ?? null,
          ...(isActive ? { code: newActiveFile?.content ?? "" } : {}),
        });
      },

      setCode: (code) => {
        set({ code, isDirty: true, saveStatus: "unsaved" });
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
      name: "compactlab-v2",
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
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
        }
      },
    }
  )
);
