import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId, slugify } from "@/lib/utils";
import { COMPACT_TEMPLATES, PROJECT_BASE_FOLDERS, PROJECT_TSCONFIG, PROJECT_PROVIDERS_TS, PROJECT_DEPLOYMENT_JSON, buildPackageJson } from "@/lib/constants";
import { COMPACT_STABLE_VERSION } from "@/lib/version";
import type { CompactVersion } from "@/lib/version";
import type { CompileResult, DeployResult, LogEntry } from "@/lib/compact";
import { fingerprintSource } from "@/lib/deploy-gate";
import {
  createCloudProject,
  deleteCloudProject,
  fetchCloudProjects,
  scheduleProjectSync,
  setProjectSyncEnabled,
  setProjectSyncErrorHandler,
  syncProjectNow,
} from "@/lib/project-sync";
import { makeLog } from "@/lib/compact";
import { getActiveNetwork } from "@/lib/user-settings";
import {
  DEFAULT_FEE_MODE,
  normalizeFeeMode,
  type FeeMode,
  type SponsorStatusResponse,
} from "@/lib/fee-mode";

export type IDEStatus = "idle" | "compiling" | "deploying" | "saving";
/** Inspector tabs. Source scan lives inside Privacy; Learn lives in the help drawer. */
export type PanelTab = "contract-ui" | "privacy";
export type LogTab = "logs" | "compile" | "network";
export type { FeeMode };

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
  language: "compact" | "markdown" | "json" | "javascript" | "typescript" | "yaml" | "text";
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
  // Per-project results — survive project switching and page refresh
  compileResult?: CompileResult | null;
  deployResult?: DeployResult | null;
  /** User-supplied private witness values (name → string form). Persisted per project. */
  witnessValues?: Record<string, string>;
  /** User-supplied Compact constructor argument values. Persisted per project. */
  constructorValues?: Record<string, string>;
  /** Base URL for full-ZK compile artifacts (e.g. /contracts/managed/<id>) */
  artifactBaseUrl?: string | null;
  /** Fingerprint of .compact source at last successful full ZK compile */
  compiledSourceHash?: string | null;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  /** Formatted tDUST balance from 1AM getDustBalance(), or null if unknown. */
  balance: string | null;
  /** Max tDUST generable from current tNIGHT (cap), if reported. */
  dustCap: string | null;
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

  /** Deploy/Call fee payment. v1 public default is self-pay. */
  feeMode: FeeMode;
  /** Last known CompactLab sponsor health (from GET /v1/sponsor/status). */
  sponsorStatus: SponsorStatusResponse | null;

  // Results
  compileResult: CompileResult | null;
  activeCircuit: string | null;
  deployResult: DeployResult | null;
  /** Active project's witness input map (synced onto Project). */
  witnessValues: Record<string, string>;
  /** Active project's constructor arg map (synced onto Project). */
  constructorValues: Record<string, string>;

  // Logs & panels
  logs: LogEntry[];
  logTab: LogTab;
  rightPanelTab: PanelTab;
  /** Help drawer (Learn topics, docs links). Not persisted. */
  helpOpen: boolean;
  bottomPanelOpen: boolean;
  sidebarOpen: boolean;

  // Compact language version label (pinned; not user-switchable until v2)
  compactVersion: CompactVersion;

  // Modal
  isNewProjectModalOpen: boolean;
  newProjectModalTemplate: string;

  // Cloud sync
  projectsHydrated: boolean;
  projectsSyncing: boolean;
  /** User-visible cloud sync / save error (banner). */
  workspaceNotice: string | null;

  // Open editor tabs (file IDs, current project)
  openTabIds: string[];
  // In-memory buffers for unsaved content per file (not persisted)
  tabBuffers: Record<string, string>;
  /** Folder IDs to expand in the sidebar after Compile mirrors managed/. */
  sidebarRevealFolderIds: string[];

  // Actions — projects
  createProject: (name: string, template?: string, description?: string) => Project;
  loadProject: (id: string) => void;
  setActiveFile: (fileId: string) => void;
  openTab: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  addFile: (name: string, language?: ProjectFile["language"], folderId?: string | null) => ProjectFile | null;
  upsertGeneratedFiles: (files: Array<{ path?: string; name: string; language: ProjectFile["language"]; content: string }>) => void;
  deleteFile: (fileId: string) => void;
  addFolder: (name: string, parentId?: string | null) => ProjectFolder | null;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, name: string) => void;
  renameFile: (fileId: string, name: string) => void;
  setCode: (code: string) => void;
  saveProject: () => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  /** Load the authenticated user's projects from the API (source of truth). */
  hydrateProjectsFromCloud: () => Promise<void>;
  /** Persist a manually entered contract address as the project's saved deploy. */
  saveContractAddress: (address: string) => void;
  clearWorkspace: () => void;
  setWorkspaceNotice: (notice: string | null) => void;

  // Actions — IDE
  setStatus: (status: IDEStatus) => void;
  setCompileResult: (result: CompileResult | null) => void;
  setDeployResult: (result: DeployResult | null) => void;
  setWitnessValue: (name: string, value: string) => void;
  setWitnessValues: (values: Record<string, string>) => void;
  setConstructorValue: (name: string, value: string) => void;
  setConstructorValues: (values: Record<string, string>) => void;
  setActiveCircuit: (circuit: string | null) => void;

  // Actions — logs
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  /** Remove logs matching a source (e.g. silent typecheck explanations). */
  clearLogsBySource: (source: string) => void;

  // Actions — wallet (real connect lives in useMidnightWallet; this syncs UI state)
  setWalletState: (wallet: WalletState) => void;
  setFeeMode: (mode: FeeMode) => void;
  setSponsorStatus: (status: SponsorStatusResponse | null) => void;

  // Actions — UI
  setRightPanelTab: (tab: PanelTab) => void;
  setHelpOpen: (open: boolean) => void;
  setLogTab: (tab: LogTab) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setNewProjectModalOpen: (open: boolean, template?: string) => void;
  setCompactVersion: (_version?: CompactVersion) => void;
  clearSidebarReveal: () => void;
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

  // ── Folders ───────────────────────────────────────────────────────────────
  // Merge template-specific folders with the shared base folders.
  // Base provides: contracts/, src/ (Midnight getting-started layout).
  // Template may add more. Compile mirrors into contracts/managed/<slug>/.
  const allTemplateFolders = [...PROJECT_BASE_FOLDERS, ...(tpl.folders ?? [])];
  const folderMap = new Map<string, ProjectFolder>();
  for (const tf of allTemplateFolders) {
    if (folderMap.has(tf.name)) continue; // dedup
    const parentId = tf.parentName ? (folderMap.get(tf.parentName)?.id ?? null) : null;
    const folder: ProjectFolder = { id: generateId(), name: tf.name, parentId, createdAt };
    folderMap.set(tf.name, folder);
  }

  // ── Files ─────────────────────────────────────────────────────────────────
  // Detect the primary .compact filename for package.json compile script.
  const contractFile =
    tpl.files.find((f) => f.language === "compact")?.name ?? "contract.compact";

  // Shared base files injected into every project (no Docker — 1AM proves in v1).
  const baseFiles = [
    buildPackageJson(slugify(name), contractFile),
    PROJECT_TSCONFIG,
    PROJECT_PROVIDERS_TS,
    PROJECT_DEPLOYMENT_JSON,
  ];

  // Merge: base files first, then template files.
  // Template files override base files with the same (name, folder) key.
  const allTemplateFiles = [...baseFiles, ...tpl.files];
  const seen = new Set<string>();
  const dedupedFiles: typeof tpl.files = [];
  for (const f of allTemplateFiles) {
    const key = `${f.folder ?? ""}::${f.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedFiles.push(f);
  }

  const files: ProjectFile[] = dedupedFiles.map((f) => ({
    id: generateId(),
    name: f.name,
    language: f.language,
    content: f.content,
    folderId: f.folder ? (folderMap.get(f.folder)?.id ?? null) : null,
    createdAt,
    updatedAt,
  }));
  return {
    id,
    name,
    slug: slugify(name),
    description,
    template,
    folders: [...folderMap.values()],
    files,
    // Default to the first .compact source file so compile works out of the box
    activeFileId: (files.find((f) => f.language === "compact") ?? files[0])?.id ?? "",
    createdAt,
    updatedAt,
  };
}

const INITIAL_PROJECTS: Project[] = [];

// ─── Store ────────────────────────────────────────────────────────────────────

export const useIDEStore = create<IDEStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      projects: INITIAL_PROJECTS,
      activeProjectId: null,
      activeProject: null,
      activeFileId: null,
      activeFile: null,

      code: "",
      isDirty: false,
      saveStatus: "saved",

      status: "idle",
      activeSteps: [],

      wallet: {
        connected: false,
        address: null,
        balance: null,
        dustCap: null,
        network: "Midnight Preprod",
      },
      feeMode: DEFAULT_FEE_MODE,
      sponsorStatus: null,

      compileResult: null,
      activeCircuit: null,
      deployResult: null,
      witnessValues: {},
      constructorValues: {},

      logs: [],
      rightPanelTab: "contract-ui",
      helpOpen: false,
      logTab: "logs",
      bottomPanelOpen: true,
      sidebarOpen: true,

      isNewProjectModalOpen: false,
      newProjectModalTemplate: "blank",
      compactVersion: COMPACT_STABLE_VERSION,

      projectsHydrated: false,
      projectsSyncing: false,
      workspaceNotice: null,

      openTabIds: [],
      tabBuffers: {},
      sidebarRevealFolderIds: [],

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
          deployResult: null,
          witnessValues: {},
          constructorValues: {},
          isNewProjectModalOpen: false,
          openTabIds: file ? [file.id] : [],
          tabBuffers: {},
          workspaceNotice: null,
        }));
        void createCloudProject(project)
          .then(() => {
            if (get().workspaceNotice?.startsWith("Cloud save failed")) {
              set({ workspaceNotice: null });
            }
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            set({
              workspaceNotice: `Cloud save failed: ${message}. This project may disappear after reload.`,
            });
            get().addLog(
              makeLog("error", `Cloud save failed: ${message}`, "network"),
            );
            get().setBottomPanelOpen(true);
            get().setLogTab("network");
          });
        return project;
      },

      loadProject: (id) => {
        const {
          projects,
          activeProjectId,
          activeFileId,
          code,
          tabBuffers,
        } = get();

        // Flush previous project's open buffer without bumping its updatedAt
        // (bumping would re-sort it above the project you just opened).
        let list = projects;
        if (activeProjectId && activeProjectId !== id && activeFileId) {
          const content = tabBuffers[activeFileId] ?? code;
          list = projects.map((p) => {
            if (p.id !== activeProjectId) return p;
            const file = p.files.find((f) => f.id === activeFileId);
            if (!file || file.content === content) return p;
            return {
              ...p,
              files: p.files.map((f) =>
                f.id === activeFileId
                  ? { ...f, content, updatedAt: Date.now() }
                  : f,
              ),
            };
          });
          const flushed = list.find((p) => p.id === activeProjectId);
          if (flushed && flushed !== projects.find((p) => p.id === activeProjectId)) {
            scheduleProjectSync(flushed);
          }
        }

        const project = list.find((p) => p.id === id);
        if (!project) return;

        // Keep the opened project at the top (MRU).
        const now = Date.now();
        const opened = { ...project, updatedAt: now };
        const reordered = [opened, ...list.filter((p) => p.id !== id)];
        const file =
          opened.files.find((f) => f.id === opened.activeFileId) ??
          opened.files[0] ??
          null;

        set({
          projects: reordered,
          activeProjectId: id,
          activeProject: opened,
          activeFileId: file?.id ?? null,
          activeFile: file,
          code: file?.content ?? "",
          isDirty: false,
          saveStatus: "saved",
          compileResult: opened.compileResult ?? null,
          deployResult: opened.deployResult?.success ? opened.deployResult : null,
          witnessValues: opened.witnessValues ?? {},
          constructorValues: opened.constructorValues ?? {},
          logs: [],
          openTabIds: file ? [file.id] : [],
          tabBuffers: {},
        });
        syncProjectNow(opened);
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

        // 3. Load content: prefer tab buffer, but never keep a stale deployment.json
        // after Deploy/save updated the project file.
        const buffered = newBuffers[fileId];
        const fileNow = updatedProject.files.find((f) => f.id === fileId) ?? file;
        const newCode =
          buffered === undefined ||
          (fileNow.name === "deployment.json" && buffered !== fileNow.content)
            ? fileNow.content
            : buffered;
        newBuffers[fileId] = newCode;

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
        const trimmed = name.trim();
        if (!trimmed) return;
        const { activeProjectId, activeProject, projects } = get();
        if (!activeProjectId || !activeProject) return;
        const target = activeProject.folders.find((f) => f.id === folderId);
        if (!target) return;
        const locked = new Set([
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
        if (locked.has(target.name.toLowerCase()) || locked.has(trimmed.toLowerCase())) return;
        // Block renames inside managed artifact trees
        const byId = new Map(activeProject.folders.map((f) => [f.id, f]));
        let walk: string | null = target.parentId;
        while (walk) {
          const p = byId.get(walk);
          if (!p) break;
          if (p.name.toLowerCase() === "managed") return;
          walk = p.parentId;
        }
        const siblingClash = activeProject.folders.some(
          (f) =>
            f.id !== folderId &&
            f.parentId === target.parentId &&
            f.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (siblingClash) return;
        const updated: Project = {
          ...activeProject,
          folders: activeProject.folders.map((f) =>
            f.id === folderId ? { ...f, name: trimmed } : f,
          ),
          updatedAt: Date.now(),
        };
        set({
          projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          activeProject: updated,
        });
        scheduleProjectSync(updated);
      },

      renameFile: (fileId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const { activeProjectId, activeProject, projects, activeFile } = get();
        if (!activeProjectId || !activeProject) return;
        const target = activeProject.files.find((f) => f.id === fileId);
        if (!target) return;
        // Only `.compact` sources may be renamed (not scaffold / managed artifacts)
        const lockedFiles = new Set([
          "package.json",
          "tsconfig.json",
          "deployment.json",
          "providers.ts",
        ]);
        if (lockedFiles.has(target.name)) return;
        const isCompact =
          target.language === "compact" || target.name.toLowerCase().endsWith(".compact");
        if (!isCompact) return;
        const byId = new Map(activeProject.folders.map((f) => [f.id, f]));
        let walk: string | null = target.folderId ?? null;
        while (walk) {
          const p = byId.get(walk);
          if (!p) break;
          if (p.name.toLowerCase() === "managed") return;
          walk = p.parentId;
        }
        const safeName = trimmed.toLowerCase().endsWith(".compact")
          ? trimmed
          : `${trimmed.replace(/\.+$/, "")}.compact`;
        const siblingClash = activeProject.files.some(
          (f) =>
            f.id !== fileId &&
            (f.folderId ?? null) === (target.folderId ?? null) &&
            f.name.toLowerCase() === safeName.toLowerCase(),
        );
        if (siblingClash) return;

        const updated: Project = {
          ...activeProject,
          files: activeProject.files.map((f) =>
            f.id === fileId
              ? { ...f, name: safeName, language: "compact", updatedAt: Date.now() }
              : f,
          ),
          updatedAt: Date.now(),
        };
        const nextActiveFile =
          activeFile?.id === fileId
            ? (updated.files.find((f) => f.id === fileId) ?? activeFile)
            : activeFile;
        set({
          projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          activeProject: updated,
          activeFile: nextActiveFile,
        });
        scheduleProjectSync(updated);
      },

      addFile: (name, language = "compact", folderId = null) => {
        const { activeProjectId, activeProject, projects, openTabIds, tabBuffers, activeFileId, code } = get();
        if (!activeProjectId || !activeProject) return null;

        const defaultContent: Partial<Record<ProjectFile["language"], string>> = {
          compact: `// ${name}\n\n// Add your circuits here\n`,
          markdown: `# ${name.replace(/\.md$/, "")}\n`,
          json: `{\n}\n`,
        };

        const file: ProjectFile = {
          id: generateId(),
          name,
          language,
          content: defaultContent[language] ?? `// ${name}\n`,
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
        scheduleProjectSync(updated);
        return file;
      },

      upsertGeneratedFiles: (files) => {
        const { activeProjectId, activeProject, projects } = get();
        if (!activeProjectId || !activeProject) return;
        const now = Date.now();

        let folders = [...(activeProject.folders ?? [])];
        let updatedFiles = [...activeProject.files];

        // Ensure the root-level "contracts" folder exists
        let contractsFolder = folders.find((f) => f.name === "contracts" && f.parentId === null);
        if (!contractsFolder) {
          contractsFolder = { id: generateId(), name: "contracts", parentId: null, createdAt: now };
          folders = [...folders, contractsFolder];
        }

        // Helper: find or create a subfolder by name under a given parent
        const ensureFolder = (name: string, parentId: string): ProjectFolder => {
          let f = folders.find((x) => x.name === name && x.parentId === parentId);
          if (!f) {
            f = { id: generateId(), name, parentId, createdAt: now };
            folders = [...folders, f];
          }
          return f;
        };

        const slug = activeProject.slug;

        for (const newFile of files) {
          // Remap compiler output into contracts/managed/[project-slug]/<path>
          // Compact emits: compiler/, contract/, zkir/, keys/ directly in outputDir.
          // We want them under contracts/managed/[slug]/ so the tree looks like:
          //   contracts/managed/hello-world/compiler/contract-info.json
          //   contracts/managed/hello-world/contract/index.js
          //   contracts/managed/hello-world/zkir/storeMessage.zkir
          const rawPath = newFile.path ?? newFile.name;
          const prefixed = `managed/${slug}/${rawPath}`;

          const segments = prefixed.split("/").filter(Boolean);
          const fileName = segments[segments.length - 1];
          const subfolders = segments.slice(0, -1);

          // Walk/create the folder chain starting from contracts/
          let parentId = contractsFolder!.id;
          for (const seg of subfolders) {
            parentId = ensureFolder(seg, parentId).id;
          }

          const idx = updatedFiles.findIndex((f) => f.name === fileName && f.folderId === parentId);
          if (idx >= 0) {
            updatedFiles[idx] = { ...updatedFiles[idx], content: newFile.content, updatedAt: now };
          } else {
            updatedFiles.push({
              id: generateId(),
              name: fileName,
              language: newFile.language,
              content: newFile.content,
              folderId: parentId,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        const updated: Project = { ...activeProject, folders, files: updatedFiles, updatedAt: now };

        // Expand contracts → managed → <slug> in the sidebar so artifacts are visible.
        const revealIds: string[] = [];
        const contractsId = contractsFolder!.id;
        revealIds.push(contractsId);
        const managed = folders.find((f) => f.name === "managed" && f.parentId === contractsId);
        if (managed) {
          revealIds.push(managed.id);
          const slugFolder = folders.find(
            (f) => f.name === slug && f.parentId === managed.id,
          );
          if (slugFolder) revealIds.push(slugFolder.id);
        }

        set({
          projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          activeProject: updated,
          sidebarRevealFolderIds: revealIds,
        });
        scheduleProjectSync(updated);
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
          if (updatedProject) scheduleProjectSync(updatedProject);
        }, 300);
      },

      deleteProject: (id) => {
        const { projects, activeProjectId } = get();
        const filtered = projects.filter((p) => p.id !== id);
        void deleteCloudProject(id).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          set({
            workspaceNotice: `Cloud delete failed: ${message}. Project may reappear after reload.`,
          });
          get().addLog(
            makeLog("error", `Cloud delete failed: ${message}`, "network"),
          );
        });
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
            compileResult: next?.compileResult ?? null,
            deployResult: next?.deployResult?.success ? next.deployResult : null,
            witnessValues: next?.witnessValues ?? {},
            constructorValues: next?.constructorValues ?? {},
            openTabIds: nextFile ? [nextFile.id] : [],
            tabBuffers: {},
          });
        } else {
          set({ projects: filtered });
        }
      },

      renameProject: (id, name) => {
        const s = slugify(name);
        set((state) => {
          const projects = state.projects.map((p) =>
            p.id === id ? { ...p, name, slug: s, updatedAt: Date.now() } : p,
          );
          const activeProject =
            state.activeProject?.id === id
              ? { ...state.activeProject, name, slug: s, updatedAt: Date.now() }
              : state.activeProject;
          const updated = projects.find((p) => p.id === id);
          if (updated) syncProjectNow(updated);
          return { projects, activeProject };
        });
      },

      hydrateProjectsFromCloud: async () => {
        setProjectSyncEnabled(true);
        setProjectSyncErrorHandler((message) => {
          set({ workspaceNotice: message });
          get().addLog(makeLog("error", message, "network"));
        });
        set({ projectsSyncing: true });
        try {
          let cloud = await fetchCloudProjects(
            new Map(
              get().projects.map((p) => [p.id, p.witnessValues ?? {}] as const),
            ),
          );

          // First login: seed Hello World so public users are never at 0 projects.
          if (cloud.length === 0) {
            const now = Date.now();
            const seed = buildProject(
              generateId(),
              "Hello, Midnight!",
              "hello-world",
              "Store a public string on-chain. Bundled keys ready, or Compile then Deploy.",
              now,
              now,
            );
            try {
              const created = await createCloudProject(seed);
              cloud = [created];
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              set({
                workspaceNotice: `Could not create starter project: ${message}`,
              });
              cloud = [seed];
            }
          }

          const activeId = get().activeProjectId;
          const preferred =
            cloud.find((p) => p.id === activeId) ?? cloud[0] ?? null;
          const file = preferred
            ? (preferred.files.find((f) => f.id === preferred.activeFileId) ??
                preferred.files[0] ??
                null)
            : null;
          set({
            projects: cloud,
            activeProjectId: preferred?.id ?? null,
            activeProject: preferred,
            activeFileId: file?.id ?? null,
            activeFile: file,
            code: file?.content ?? "",
            compileResult: preferred?.compileResult ?? null,
            deployResult: preferred?.deployResult?.success ? preferred.deployResult : null,
            witnessValues: preferred?.witnessValues ?? {},
            constructorValues: preferred?.constructorValues ?? {},
            openTabIds: file ? [file.id] : [],
            tabBuffers: {},
            projectsHydrated: true,
            projectsSyncing: false,
            isDirty: false,
            saveStatus: "saved",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn("[ide] hydrateProjectsFromCloud failed", err);
          set({
            projectsHydrated: true,
            projectsSyncing: false,
            workspaceNotice: `Could not load projects: ${message}`,
          });
        }
      },

      saveContractAddress: (address) => {
        const trimmed = address.trim();
        if (!trimmed) return;
        const { activeProjectId, activeProject, projects, deployResult } = get();
        if (!activeProjectId || !activeProject) return;
        const nextDeploy: DeployResult = {
          success: true,
          contractAddress: trimmed,
          transactionHash: deployResult?.transactionHash,
          blockNumber: deployResult?.blockNumber,
          duration: deployResult?.duration ?? 0,
          network: getActiveNetwork().id,
        };
        const payload = JSON.stringify(
          {
            network: nextDeploy.network,
            contractAddress: trimmed,
            txHash: nextDeploy.transactionHash ?? null,
            blockHeight: nextDeploy.blockNumber ?? null,
            deployedAt: new Date().toISOString(),
            template: activeProject.template,
            artifactBaseUrl: activeProject.artifactBaseUrl ?? null,
          },
          null,
          2,
        );
        let files = activeProject.files;
        const idx = files.findIndex(
          (f) => f.name === "deployment.json" && (f.folderId == null || f.folderId === ""),
        );
        let deploymentFileId: string;
        if (idx >= 0) {
          deploymentFileId = files[idx]!.id;
          files = files.map((f, i) =>
            i === idx ? { ...f, content: payload, updatedAt: Date.now() } : f,
          );
        } else {
          deploymentFileId = generateId();
          files = [
            ...files,
            {
              id: deploymentFileId,
              name: "deployment.json",
              language: "json" as const,
              content: payload,
              folderId: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ];
        }
        const { activeFileId, activeFile, tabBuffers } = get();
        const nextBuffers = { ...tabBuffers, [deploymentFileId]: payload };
        const updated = {
          ...activeProject,
          files,
          deployResult: nextDeploy,
          updatedAt: Date.now(),
        };
        set({
          deployResult: nextDeploy,
          activeProject: updated,
          projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          tabBuffers: nextBuffers,
          ...(activeFileId === deploymentFileId
            ? {
                code: payload,
                activeFile: files.find((f) => f.id === deploymentFileId) ?? activeFile,
                isDirty: false,
                saveStatus: "saved" as const,
              }
            : {}),
        });
        syncProjectNow(updated);
      },

      clearWorkspace: () => {
        setProjectSyncEnabled(false);
        set({
          projects: [],
          activeProjectId: null,
          activeProject: null,
          activeFileId: null,
          activeFile: null,
          code: "",
          compileResult: null,
          deployResult: null,
          witnessValues: {},
          constructorValues: {},
          openTabIds: [],
          tabBuffers: {},
          projectsHydrated: false,
          projectsSyncing: false,
          workspaceNotice: null,
          sidebarRevealFolderIds: [],
        });
      },

      setWorkspaceNotice: (workspaceNotice) => set({ workspaceNotice }),

      // ── IDE actions ────────────────────────────────────────────────────────
      setStatus: (status) => set({ status }),
      setCompileResult: (compileResult) => {
        const { activeProjectId, activeProject, projects, code, activeFile, tabBuffers } = get();
        if (activeProjectId && activeProject) {
          const compact = activeProject.files.find((f) => f.language === "compact");
          let source = compact?.content ?? "";
          if (activeFile?.language === "compact") source = code;
          else if (compact && tabBuffers[compact.id] !== undefined) source = tabBuffers[compact.id];

          const fullZk =
            !!compileResult?.success &&
            !compileResult.skipZk &&
            !!compileResult.artifactBaseUrl;

          // Keep .compact file content in sync with what was compiled / is open
          let files = activeProject.files;
          if (compact && source && compact.content !== source) {
            files = files.map((f) =>
              f.id === compact.id ? { ...f, content: source, updatedAt: Date.now() } : f,
            );
          }

          const updated = {
            ...activeProject,
            files,
            compileResult,
            artifactBaseUrl: fullZk
              ? compileResult.artifactBaseUrl
              : (activeProject.artifactBaseUrl ?? null),
            compiledSourceHash: fullZk
              ? fingerprintSource(source)
              : (activeProject.compiledSourceHash ?? null),
            updatedAt: Date.now(),
          };
          set({
            compileResult,
            activeProject: updated,
            projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          });
          syncProjectNow(updated);
        } else {
          set({ compileResult });
        }
      },
      setDeployResult: (result) => {
        // Failures are session-only. Do not persist them on the project — otherwise
        // Connect 1AM (which opens the Network panel) looks like a new failed Deploy.
        if (!result?.success) {
          set({ deployResult: result });
          return;
        }
        const deployResult: DeployResult = { ...result, network: result.network ?? getActiveNetwork().id };
        const { activeProjectId, activeProject, projects, activeFileId, activeFile, tabBuffers } =
          get();
        if (activeProjectId && activeProject) {
          let files = activeProject.files;
          let nextBuffers = tabBuffers;
          let nextCode: string | undefined;
          let nextActiveFile = activeFile;

          if (deployResult.success) {
            const payload = JSON.stringify(
              {
                network: deployResult.network,
                contractAddress: deployResult.contractAddress ?? null,
                txHash: deployResult.transactionHash ?? null,
                blockHeight: deployResult.blockNumber ?? null,
                deployedAt: new Date().toISOString(),
                template: activeProject.template,
                artifactBaseUrl: activeProject.artifactBaseUrl ?? null,
              },
              null,
              2,
            );
            const idx = files.findIndex(
              (f) => f.name === "deployment.json" && (f.folderId == null || f.folderId === ""),
            );
            let deploymentFileId: string;
            if (idx >= 0) {
              deploymentFileId = files[idx]!.id;
              files = files.map((f, i) =>
                i === idx ? { ...f, content: payload, updatedAt: Date.now() } : f,
              );
            } else {
              deploymentFileId = generateId();
              files = [
                ...files,
                {
                  id: deploymentFileId,
                  name: "deployment.json",
                  language: "json" as const,
                  content: payload,
                  folderId: null,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ];
            }

            // Keep editor / tab buffer in sync so the file does not look empty after Deploy.
            nextBuffers = { ...tabBuffers, [deploymentFileId]: payload };
            if (activeFileId === deploymentFileId) {
              nextCode = payload;
              nextActiveFile = files.find((f) => f.id === deploymentFileId) ?? activeFile;
            }
          }

          const updated = {
            ...activeProject,
            deployResult,
            files,
            updatedAt: Date.now(),
          };
          set({
            deployResult,
            activeProject: updated,
            projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
            tabBuffers: nextBuffers,
            ...(nextCode !== undefined
              ? { code: nextCode, activeFile: nextActiveFile, isDirty: false, saveStatus: "saved" }
              : {}),
          });
          syncProjectNow(updated);
        } else {
          set({ deployResult });
        }
      },
      setWitnessValue: (name, value) => {
        const { activeProjectId, activeProject, projects, witnessValues } = get();
        const next = { ...witnessValues, [name]: value };
        if (activeProjectId && activeProject) {
          const updated = { ...activeProject, witnessValues: next, updatedAt: Date.now() };
          set({
            witnessValues: next,
            activeProject: updated,
            projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          });
          scheduleProjectSync(updated);
        } else {
          set({ witnessValues: next });
        }
      },
      setWitnessValues: (next) => {
        const { activeProjectId, activeProject, projects } = get();
        if (activeProjectId && activeProject) {
          const updated = { ...activeProject, witnessValues: next, updatedAt: Date.now() };
          set({
            witnessValues: next,
            activeProject: updated,
            projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          });
          scheduleProjectSync(updated);
        } else {
          set({ witnessValues: next });
        }
      },
      setConstructorValue: (name, value) => {
        const { activeProjectId, activeProject, projects, constructorValues } = get();
        const next = { ...constructorValues, [name]: value };
        if (activeProjectId && activeProject) {
          const updated = { ...activeProject, constructorValues: next, updatedAt: Date.now() };
          set({
            constructorValues: next,
            activeProject: updated,
            projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          });
          scheduleProjectSync(updated);
        } else {
          set({ constructorValues: next });
        }
      },
      setConstructorValues: (next) => {
        const { activeProjectId, activeProject, projects } = get();
        if (activeProjectId && activeProject) {
          const updated = { ...activeProject, constructorValues: next, updatedAt: Date.now() };
          set({
            constructorValues: next,
            activeProject: updated,
            projects: projects.map((p) => (p.id === activeProjectId ? updated : p)),
          });
          scheduleProjectSync(updated);
        } else {
          set({ constructorValues: next });
        }
      },
      setActiveCircuit: (activeCircuit) => set({ activeCircuit }),

      addLog: (log) =>
        set((s) => ({ logs: [...s.logs.slice(-500), log] })),
      clearLogs: () => set({ logs: [] }),
      clearLogsBySource: (source) =>
        set((s) => ({ logs: s.logs.filter((l) => l.source !== source) })),

      setWalletState: (wallet) => set({ wallet }),
      setFeeMode: (feeMode) => set({ feeMode: normalizeFeeMode(feeMode) }),
      setSponsorStatus: (sponsorStatus) => set({ sponsorStatus }),

      setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      setLogTab: (logTab) => set({ logTab }),
      setBottomPanelOpen: (bottomPanelOpen) => set({ bottomPanelOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setNewProjectModalOpen: (open, template = "blank") =>
        set({ isNewProjectModalOpen: open, newProjectModalTemplate: template }),
      // Compact version is pinned server-side; keep field for persisted state shape only.
      setCompactVersion: () => set({ compactVersion: COMPACT_STABLE_VERSION }),
      clearSidebarReveal: () => set({ sidebarRevealFolderIds: [] }),
    }),
    {
      name: "compactlab-v7",
      version: 7,
      migrate: (persistedState, fromVersion) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = persistedState as any;
        if (
          state?.rightPanelTab &&
          state.rightPanelTab !== "contract-ui" &&
          state.rightPanelTab !== "privacy"
        ) {
          state.rightPanelTab = "contract-ui";
        }
        // v6: projects are per-user in the API — drop auto-seeded local templates
        if (fromVersion < 6) {
          state.projects = [];
          state.activeProjectId = null;
          state.openTabIds = [];
        }
        state.feeMode = normalizeFeeMode(state.feeMode);
        return persistedState as any;
      },
      partialize: (state) => ({
        // Cache last-known cloud projects for faster paint; cloud rehydrate is source of truth
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        openTabIds: state.openTabIds,
        sidebarOpen: state.sidebarOpen,
        bottomPanelOpen: state.bottomPanelOpen,
        rightPanelTab: state.rightPanelTab,
        feeMode: state.feeMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.compactVersion = COMPACT_STABLE_VERSION;
        state.projectsHydrated = false;
        // Older sessions may have persisted the removed "source-scan" / "learn" tabs.
        const persistedTab = state.rightPanelTab as string;
        if (persistedTab !== "contract-ui" && persistedTab !== "privacy") {
          state.rightPanelTab = persistedTab === "source-scan" ? "privacy" : "contract-ui";
        }
        // Persisted "sponsored" must not survive when the flag is off.
        state.feeMode = normalizeFeeMode(state.feeMode);
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
          state.compileResult = proj.compileResult ?? null;
          state.deployResult = proj.deployResult?.success ? proj.deployResult : null;
          state.witnessValues = proj.witnessValues ?? {};
          state.constructorValues = proj.constructorValues ?? {};
          const validFileIds = new Set(proj.files?.map((f) => f.id) ?? []);
          const restoredTabs = (state.openTabIds ?? []).filter((id) => validFileIds.has(id));
          state.openTabIds = restoredTabs.length > 0 ? restoredTabs : (file ? [file.id] : []);
          state.tabBuffers = {};
        } else {
          state.activeProject = null;
          state.activeFileId = null;
          state.activeFile = null;
          state.code = "";
          state.compileResult = null;
          state.deployResult = null;
          state.witnessValues = {};
          state.constructorValues = {};
          state.openTabIds = [];
        }
      },
    }
  )
);
