import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId } from "@/lib/utils";
import { COMPACT_TEMPLATES, SAMPLE_PROJECTS } from "@/lib/constants";
import type { CompileResult, SimulateResult, DeployResult, LogEntry } from "@/lib/compact";

export type IDEStatus =
  | "idle"
  | "compiling"
  | "simulating"
  | "deploying"
  | "saving";

export type PanelTab = "simulation" | "privacy" | "contract-ui";
export type LogTab = "logs" | "compile" | "network";

export interface Project {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
  template?: string;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  balance: string | null;
  network: string;
}

export interface IDEStore {
  // Projects
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;

  // Editor state
  code: string;
  isDirty: boolean;
  saveStatus: "saved" | "saving" | "unsaved";

  // IDE status
  status: IDEStatus;
  activeSteps: string[];

  // Wallet
  wallet: WalletState;

  // Compile
  compileResult: CompileResult | null;

  // Simulate
  simulateResult: SimulateResult | null;
  simulateInputs: Record<string, string>;
  activeCircuit: string | null;

  // Deploy
  deployResult: DeployResult | null;

  // Logs
  logs: LogEntry[];

  // Right panel
  rightPanelTab: PanelTab;

  // Bottom panel
  logTab: LogTab;
  bottomPanelOpen: boolean;

  // Layout
  sidebarOpen: boolean;

  // Actions
  createProject: (name: string, template?: string) => Project;
  loadProject: (id: string) => void;
  setCode: (code: string) => void;
  saveProject: () => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;

  setStatus: (status: IDEStatus) => void;
  setCompileResult: (result: CompileResult | null) => void;
  setSimulateResult: (result: SimulateResult | null) => void;
  setDeployResult: (result: DeployResult | null) => void;
  setSimulateInputs: (inputs: Record<string, string>) => void;
  setActiveCircuit: (circuit: string | null) => void;

  addLog: (log: LogEntry) => void;
  clearLogs: () => void;

  connectWallet: () => void;
  disconnectWallet: () => void;

  setRightPanelTab: (tab: PanelTab) => void;
  setLogTab: (tab: LogTab) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
}

const INITIAL_PROJECTS: Project[] = SAMPLE_PROJECTS.map((p) => ({
  id: p.id,
  name: p.name,
  code: COMPACT_TEMPLATES[p.template as keyof typeof COMPACT_TEMPLATES]?.code || COMPACT_TEMPLATES.blank.code,
  createdAt: p.updatedAt - 1000 * 60 * 60,
  updatedAt: p.updatedAt,
  template: p.template,
}));

export const useIDEStore = create<IDEStore>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: INITIAL_PROJECTS,
      activeProjectId: INITIAL_PROJECTS[0]?.id ?? null,
      activeProject: INITIAL_PROJECTS[0] ?? null,
      code: INITIAL_PROJECTS[0]?.code ?? "",
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

      // Project actions
      createProject: (name: string, template = "blank") => {
        const templateCode = COMPACT_TEMPLATES[template as keyof typeof COMPACT_TEMPLATES]?.code || COMPACT_TEMPLATES.blank.code;
        const project: Project = {
          id: generateId(),
          name,
          code: templateCode,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          template,
        };
        set((state) => ({
          projects: [project, ...state.projects],
          activeProjectId: project.id,
          activeProject: project,
          code: project.code,
          isDirty: false,
          saveStatus: "saved",
          compileResult: null,
          simulateResult: null,
          deployResult: null,
        }));
        return project;
      },

      loadProject: (id: string) => {
        const project = get().projects.find((p) => p.id === id);
        if (!project) return;
        set({
          activeProjectId: id,
          activeProject: project,
          code: project.code,
          isDirty: false,
          saveStatus: "saved",
          compileResult: null,
          simulateResult: null,
          deployResult: null,
          logs: [],
        });
      },

      setCode: (code: string) => {
        set({ code, isDirty: true, saveStatus: "unsaved" });
        // Auto-save after debounce (handled in component with debounce)
      },

      saveProject: () => {
        const { activeProjectId, code, projects } = get();
        if (!activeProjectId) return;
        const now = Date.now();
        set({
          saveStatus: "saving",
          isDirty: false,
        });
        setTimeout(() => {
          const updatedProjects = projects.map((p) =>
            p.id === activeProjectId ? { ...p, code, updatedAt: now } : p
          );
          const updatedProject = updatedProjects.find((p) => p.id === activeProjectId) || null;
          set({
            projects: updatedProjects,
            activeProject: updatedProject,
            saveStatus: "saved",
          });
        }, 300);
      },

      deleteProject: (id: string) => {
        const { projects, activeProjectId } = get();
        const filtered = projects.filter((p) => p.id !== id);
        const newActive = activeProjectId === id ? filtered[0] ?? null : null;
        set({
          projects: filtered,
          ...(newActive ? {
            activeProjectId: newActive.id,
            activeProject: newActive,
            code: newActive.code,
          } : {}),
        });
      },

      renameProject: (id: string, name: string) => {
        set((state) => ({
          projects: state.projects.map((p) => p.id === id ? { ...p, name } : p),
          activeProject: state.activeProject?.id === id ? { ...state.activeProject, name } : state.activeProject,
        }));
      },

      // Status actions
      setStatus: (status) => set({ status }),
      setCompileResult: (compileResult) => set({ compileResult }),
      setSimulateResult: (simulateResult) => set({ simulateResult }),
      setDeployResult: (deployResult) => set({ deployResult }),
      setSimulateInputs: (simulateInputs) => set({ simulateInputs }),
      setActiveCircuit: (activeCircuit) => set({ activeCircuit }),

      // Log actions
      addLog: (log) => set((state) => ({
        logs: [...state.logs.slice(-500), log], // keep last 500 logs
      })),
      clearLogs: () => set({ logs: [] }),

      // Wallet actions
      connectWallet: () => set({
        wallet: {
          connected: true,
          address: "0x742d35Cc6634C0532925a3b8D4C9b5A15e8c3a4",
          balance: "12.847 DUST",
          network: "Midnight Devnet",
        },
      }),
      disconnectWallet: () => set({
        wallet: {
          connected: false,
          address: null,
          balance: null,
          network: "Midnight Devnet",
        },
      }),

      // UI actions
      setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
      setLogTab: (logTab) => set({ logTab }),
      setBottomPanelOpen: (bottomPanelOpen) => set({ bottomPanelOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "compactlab-ide",
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        sidebarOpen: state.sidebarOpen,
        bottomPanelOpen: state.bottomPanelOpen,
        rightPanelTab: state.rightPanelTab,
      }),
    }
  )
);
