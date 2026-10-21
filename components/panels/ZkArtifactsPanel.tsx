"use client";

import { useEffect, useMemo, useState } from "react";
import { useIDEStore, type Project } from "@/store/ide";
import { Button, Badge } from "@/components/ui";
import { apiFetch, getToken } from "@/lib/api";
import { bundledAssetBase, isDeployableTemplate, isOutdatedManagedArtifactUrl, OUTDATED_ARTIFACT_MESSAGE } from "@/lib/playground-assets";
import { cn } from "@/lib/utils";

type ListedFile = { path: string; url: string; bytes?: number };

function folderPath(
  folders: Project["folders"],
  folderId: string | null | undefined,
): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let cur = folderId ?? null;
  while (cur) {
    const f = byId.get(cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parentId;
  }
  return parts.join("/");
}

function managedFilesFromProject(project: Project): Array<{ id: string; path: string }> {
  return project.files
    .map((f) => {
      const dir = folderPath(project.folders, f.folderId);
      const path = dir ? `${dir}/${f.name}` : f.name;
      return { id: f.id, path };
    })
    .filter((f) => /(^|\/)managed\//.test(f.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Shows compiled ZK artifacts in the IDE: project tree files + API base listing.
 */
export function ZkArtifactsPanel({ className }: { className?: string }) {
  const activeProject = useIDEStore((s) => s.activeProject);
  const compileResult = useIDEStore((s) => s.compileResult);
  const setActiveFile = useIDEStore((s) => s.setActiveFile);
  const setRightPanelTab = useIDEStore((s) => s.setRightPanelTab);

  const artifactBaseUrl =
    activeProject?.artifactBaseUrl || compileResult?.artifactBaseUrl || null;

  const localManaged = useMemo(
    () => (activeProject ? managedFilesFromProject(activeProject) : []),
    [activeProject],
  );

  const [remote, setRemote] = useState<ListedFile[] | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!artifactBaseUrl || !getToken()) {
      setRemote(null);
      setRemoteError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRemoteError(null);
    void (async () => {
      try {
        // Prefer the lightweight public index (paths only, no key bodies).
        const res = await fetch(artifactBaseUrl.replace(/\/$/, ""));
        const text = await res.text();
        let json: { files?: ListedFile[]; error?: string } = {};
        try {
          json = text ? (JSON.parse(text) as typeof json) : {};
        } catch {
          throw new Error(
            `Artifact index returned non-JSON (${res.status}): ${text.trim().slice(0, 120) || res.statusText}`,
          );
        }
        if (cancelled) return;
        if (!res.ok) {
          setRemoteError(json.error || `Could not list artifacts (${res.status})`);
          setRemote(null);
          return;
        }
        setRemote(json.files ?? []);
      } catch (err) {
        if (!cancelled) {
          setRemoteError(err instanceof Error ? err.message : String(err));
          setRemote(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifactBaseUrl]);

  const bundled =
    !artifactBaseUrl &&
    activeProject &&
    isDeployableTemplate(activeProject.template)
      ? bundledAssetBase(activeProject.template)
      : null;

  if (!activeProject) return null;

  if (isOutdatedManagedArtifactUrl(artifactBaseUrl)) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-2xs font-medium text-text-muted uppercase tracking-wide">
          ZK artifacts
        </p>
        <div className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 space-y-1">
          <p className="text-xs font-medium text-warning">Compile artifacts outdated</p>
          <p className="text-xs text-text-secondary leading-relaxed">{OUTDATED_ARTIFACT_MESSAGE}</p>
        </div>
      </div>
    );
  }

  if (!artifactBaseUrl && !bundled && localManaged.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-2xs font-medium text-text-muted uppercase tracking-wide">
          ZK artifacts
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Run <span className="text-text-primary font-medium">Compile</span> to generate{" "}
          <span className="font-mono">contracts/managed/…</span> (compiler, contract, keys, zkir)
          and an API base URL used by Deploy/Call.
        </p>
      </div>
    );
  }

  const openLocal = (fileId: string) => {
    setActiveFile(fileId);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-medium text-text-muted uppercase tracking-wide">
          ZK artifacts
        </p>
        {artifactBaseUrl ? (
          <Badge variant="success" size="sm">
            compiled
          </Badge>
        ) : bundled ? (
          <Badge variant="info" size="sm">
            bundled
          </Badge>
        ) : null}
      </div>

      {artifactBaseUrl && (
        <div className="rounded-md border border-border bg-surface-2 px-2.5 py-2 space-y-1.5">
          <p className="text-2xs text-text-muted">API base (Deploy/Call loads files from here)</p>
          <a
            href={artifactBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-2xs font-mono text-accent hover:underline break-all"
            title={artifactBaseUrl}
          >
            {artifactBaseUrl}
          </a>
        </div>
      )}

      {bundled && !artifactBaseUrl && (
        <div className="rounded-md border border-border bg-surface-2 px-2.5 py-2 space-y-1">
          <p className="text-2xs text-text-muted">
            Using bundled ZK assets for this template (no Compile yet).
          </p>
          <a
            href={bundled}
            target="_blank"
            rel="noreferrer"
            className="text-2xs font-mono text-accent hover:underline"
          >
            {bundled}
          </a>
        </div>
      )}

      {localManaged.length > 0 && (
        <div className="space-y-1">
          <p className="text-2xs text-text-muted">In project tree</p>
          <ul className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
            {localManaged.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => openLocal(f.id)}
                  className="w-full text-left px-2.5 py-1.5 text-2xs font-mono text-text-secondary hover:bg-white/[0.04] hover:text-text-primary truncate"
                  title={`Open ${f.path}`}
                >
                  {f.path.replace(/^contracts\//, "")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && (
        <p className="text-2xs text-text-dim">Loading API file list…</p>
      )}
      {remoteError && (
        <p className="text-2xs text-warning leading-relaxed">{remoteError}</p>
      )}
      {remote && remote.length > 0 && (
        <div className="space-y-1">
          <p className="text-2xs text-text-muted">On API (open in browser)</p>
          <ul className="max-h-36 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
            {remote.map((f) => (
              <li key={f.path}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block px-2.5 py-1.5 text-2xs font-mono text-accent hover:bg-white/[0.04] truncate"
                  title={f.url}
                >
                  {f.path}
                  {typeof f.bytes === "number" ? (
                    <span className="text-text-dim ml-1">({f.bytes} B)</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {localManaged[0] && (
          <Button size="xs" variant="default" onClick={() => openLocal(localManaged[0]!.id)}>
            Open in editor
          </Button>
        )}
        {artifactBaseUrl && (
          <a
            href={artifactBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded text-xs px-1.5 py-0.5 h-5 border border-border text-text-secondary hover:text-text-primary hover:bg-white/5"
          >
            API index ↗
          </a>
        )}
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setRightPanelTab("privacy")}
          title="Source scan of your .compact"
        >
          Source
        </Button>
      </div>
    </div>
  );
}
