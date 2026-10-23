/**
 * Cloud project sync helpers — maps between IDE Project and API payloads.
 */

import {
  ApiError,
  createBrowserApi,
  getToken,
  type CloudProject,
  type CloudProjectPatch,
  type CloudProjectUpsert,
} from "@/lib/api";
import type { CompileResult, DeployResult } from "@/lib/compact";
import type { Project } from "@/store/ide";
import { getUserSettingsSnapshot } from "@/lib/user-settings";

const api = () => createBrowserApi();

export function cloudToProject(c: CloudProject, localWitnesses?: Record<string, string>): Project {
  const deployResult =
    (c.deployResult as DeployResult | null | undefined) ??
    (c.contractAddress
      ? {
          success: true,
          contractAddress: c.contractAddress,
          transactionHash: c.deployTxHash ?? undefined,
          blockNumber: c.deployBlockNumber ?? undefined,
          duration: 0,
        }
      : null);

  const { syncWitnessesToCloud } = getUserSettingsSnapshot();
  const witnessValues = syncWitnessesToCloud
    ? (c.witnessValues ?? {})
    : (localWitnesses ?? {});

  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    template: c.template,
    folders: c.folders,
    files: c.files,
    activeFileId: c.activeFileId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    compileResult: (c.compileResult as CompileResult | null) ?? null,
    deployResult,
    witnessValues,
    constructorValues: c.constructorValues ?? {},
    artifactBaseUrl: c.artifactBaseUrl,
    compiledSourceHash: c.compiledSourceHash,
  };
}

export function projectToUpsert(p: Project): CloudProjectUpsert {
  const { syncWitnessesToCloud } = getUserSettingsSnapshot();
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    template: p.template,
    folders: p.folders,
    files: p.files,
    activeFileId: p.activeFileId,
    artifactBaseUrl: p.artifactBaseUrl ?? null,
    compiledSourceHash: p.compiledSourceHash ?? null,
    contractAddress: p.deployResult?.contractAddress ?? null,
    deployTxHash: p.deployResult?.transactionHash ?? null,
    deployBlockNumber: p.deployResult?.blockNumber ?? null,
    deployResult: p.deployResult ?? null,
    // Privacy: keep witnesses device-local when the user opts out of cloud sync.
    witnessValues: syncWitnessesToCloud ? (p.witnessValues ?? {}) : {},
    constructorValues: p.constructorValues ?? {},
    compileResult: p.compileResult ?? null,
  };
}

export function projectToPatch(p: Project): CloudProjectPatch {
  const upsert = projectToUpsert(p);
  const { id: _id, template: _t, ...patch } = upsert as CloudProjectUpsert & {
    id?: string;
    template?: string;
  };
  void _id;
  void _t;
  return patch;
}

let syncEnabled = false;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
let syncErrorHandler: ((message: string) => void) | null = null;

export function setProjectSyncEnabled(enabled: boolean) {
  syncEnabled = enabled && !!getToken();
  if (syncEnabled) scheduleRetry(0);
}

export function isProjectSyncEnabled() {
  return syncEnabled && !!getToken();
}

/** Register UI handler for cloud sync failures (toasts / banners). */
export function setProjectSyncErrorHandler(handler: ((message: string) => void) | null) {
  syncErrorHandler = handler;
}

function reportSyncError(err: unknown, context: string) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[project-sync] ${context}`, err);
  syncErrorHandler?.(`${context}: ${message}`);
}

// ─── Durable sync ────────────────────────────────────────────────────────────
//
// Work is never lost: every project change is kept in the persisted IDE store
// (localStorage) and its id is recorded here until the cloud confirms it. Failed
// saves (offline, maintenance, server errors) are retried, and cloud hydration
// keeps the local copy of any project still on this list.

const UNSYNCED_KEY = "compactlab-unsynced-projects";
const RETRY_STEPS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

/** Bumped on every change, so an older in-flight save can't mark a newer edit as synced. */
const versions = new Map<string, number>();
let unsynced = new Set<string>(readUnsynced());
let projectSource: ((id: string) => Project | undefined) | null = null;
let paused = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryStep = 0;
const listeners = new Set<() => void>();

function readUnsynced(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(UNSYNCED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeUnsynced() {
  try {
    localStorage.setItem(UNSYNCED_KEY, JSON.stringify([...unsynced]));
  } catch {
    /* storage full or blocked: the in-memory set still drives retries */
  }
  for (const l of listeners) l();
}

function markUnsynced(id: string) {
  versions.set(id, (versions.get(id) ?? 0) + 1);
  if (!unsynced.has(id)) {
    unsynced.add(id);
    writeUnsynced();
  }
}

function markSynced(id: string, version: number | undefined) {
  if (versions.get(id) !== version) return;
  if (unsynced.delete(id)) writeUnsynced();
}

/** Lets retries read the latest copy of a project from the IDE store. */
export function setProjectSource(source: (id: string) => Project | undefined) {
  projectSource = source;
}

/** Ids of projects with changes the cloud has not confirmed yet. */
export function unsyncedProjectIds(): string[] {
  return [...unsynced];
}

export function subscribeUnsynced(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Pause cloud saves (maintenance). Changes still pile up locally and are flushed on resume. */
export function setProjectSyncPaused(next: boolean) {
  paused = next;
  if (!paused) scheduleRetry(0);
}

/** Forget pending work (sign-out clears the workspace). */
export function resetProjectSync() {
  for (const t of pendingTimers.values()) clearTimeout(t);
  pendingTimers.clear();
  versions.clear();
  unsynced = new Set();
  writeUnsynced();
}

async function pushProject(id: string): Promise<boolean> {
  const project = projectSource?.(id);
  if (!project) {
    // Deleted locally: nothing left to save.
    markSynced(id, versions.get(id));
    return true;
  }
  const version = versions.get(id);
  try {
    await patchCloudProject(id, projectToPatch(project));
    markSynced(id, version);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      try {
        await createCloudProject(project);
        markSynced(id, version);
        return true;
      } catch (createErr) {
        reportSyncError(createErr, "Could not save project to the cloud");
        return false;
      }
    }
    // Maintenance and network errors are expected to clear up: retry quietly.
    if (!(err instanceof ApiError && err.status === 503) && !(err instanceof TypeError)) {
      reportSyncError(err, "Could not save project to the cloud");
    }
    return false;
  }
}

function scheduleRetry(delayMs?: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (!unsynced.size || !isProjectSyncEnabled() || paused) return;
  const delay = delayMs ?? RETRY_STEPS_MS[Math.min(retryStep, RETRY_STEPS_MS.length - 1)]!;
  retryTimer = setTimeout(() => {
    void flushProjectSync().then((ok) => {
      retryStep = ok ? 0 : retryStep + 1;
      if (!ok) scheduleRetry();
    });
  }, delay);
}

/**
 * Send every pending and unconfirmed project now. Resolves true when the cloud
 * has all of them. Safe to call often.
 */
export async function flushProjectSync(): Promise<boolean> {
  for (const [id, t] of pendingTimers) {
    clearTimeout(t);
    pendingTimers.delete(id);
  }
  if (!isProjectSyncEnabled() || paused) return unsynced.size === 0;
  const results = await Promise.all([...unsynced].map(pushProject));
  return results.every(Boolean);
}

export async function fetchCloudProjects(
  localById?: Map<string, Record<string, string>>,
): Promise<Project[]> {
  const { projects } = await api().listProjects(true);
  return projects.map((p) => cloudToProject(p, localById?.get(p.id)));
}

export async function createCloudProject(project: Project): Promise<Project> {
  const { project: created } = await api().createProject(projectToUpsert(project));
  return cloudToProject(created, project.witnessValues);
}

export async function deleteCloudProject(id: string): Promise<void> {
  await api().deleteProject(id);
}

export async function patchCloudProject(
  id: string,
  patch: CloudProjectPatch,
): Promise<Project | null> {
  if (!isProjectSyncEnabled()) return null;
  const { project } = await api().updateProject(id, patch);
  // Callers discard the return value; when syncing with witnesses opted out,
  // cloud payload has empty witnesses — do not merge into IDE from this path.
  return cloudToProject(project);
}

/** Debounced full-tree sync for active editing. */
export function scheduleProjectSync(project: Project, delayMs = 800) {
  markUnsynced(project.id);
  if (!isProjectSyncEnabled() || paused) return;
  const prev = pendingTimers.get(project.id);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    pendingTimers.delete(project.id);
    void pushProject(project.id).then((ok) => !ok && scheduleRetry());
  }, delayMs);
  pendingTimers.set(project.id, timer);
}

/** Immediate sync (rename, deploy, compile metadata). */
export function syncProjectNow(project: Project) {
  markUnsynced(project.id);
  if (!isProjectSyncEnabled() || paused) return;
  const prev = pendingTimers.get(project.id);
  if (prev) clearTimeout(prev);
  pendingTimers.delete(project.id);
  void pushProject(project.id).then((ok) => !ok && scheduleRetry());
}
