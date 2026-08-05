/**
 * Cloud project sync helpers — maps between IDE Project and API payloads.
 */

import {
  createBrowserApi,
  getToken,
  type CloudProject,
  type CloudProjectPatch,
  type CloudProjectUpsert,
} from "@/lib/api";
import type { CompileResult, DeployResult } from "@/lib/compact";
import type { Project } from "@/store/ide";

const api = () => createBrowserApi();

export function cloudToProject(c: CloudProject): Project {
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
    witnessValues: c.witnessValues ?? {},
    artifactBaseUrl: c.artifactBaseUrl,
    compiledSourceHash: c.compiledSourceHash,
  };
}

export function projectToUpsert(p: Project): CloudProjectUpsert {
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
    witnessValues: p.witnessValues ?? {},
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

export async function fetchCloudProjects(): Promise<Project[]> {
  const { projects } = await api().listProjects(true);
  return projects.map(cloudToProject);
}

export async function createCloudProject(project: Project): Promise<Project> {
  const { project: created } = await api().createProject(projectToUpsert(project));
  return cloudToProject(created);
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
  return cloudToProject(project);
}

/** Debounced full-tree sync for active editing. */
export function scheduleProjectSync(project: Project, delayMs = 800) {
  if (!isProjectSyncEnabled()) return;
  const prev = pendingTimers.get(project.id);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    pendingTimers.delete(project.id);
    void patchCloudProject(project.id, projectToPatch(project)).catch((err) => {
      reportSyncError(err, "Could not save project to the cloud");
    });
  }, delayMs);
  pendingTimers.set(project.id, timer);
}

/** Immediate sync (rename, deploy, compile metadata). */
export function syncProjectNow(project: Project) {
  if (!isProjectSyncEnabled()) return;
  const prev = pendingTimers.get(project.id);
  if (prev) clearTimeout(prev);
  pendingTimers.delete(project.id);
  void patchCloudProject(project.id, projectToPatch(project)).catch((err) => {
    reportSyncError(err, "Could not save project to the cloud");
  });
}
