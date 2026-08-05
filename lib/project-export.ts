/**
 * Export an IDE project as a zip (sources + deployment.json + optional managed ZK files).
 */

import JSZip from "jszip";
import type { Project, ProjectFile, ProjectFolder } from "@/store/ide";

function folderPath(
  folders: ProjectFolder[],
  folderId: string | null | undefined,
): string {
  if (!folderId) return "";
  const parts: string[] = [];
  let current: string | null | undefined = folderId;
  const byId = new Map(folders.map((f) => [f.id, f]));
  while (current) {
    const folder = byId.get(current);
    if (!folder) break;
    parts.unshift(folder.name);
    current = folder.parentId;
  }
  return parts.join("/");
}

function filePath(project: Project, file: ProjectFile): string {
  const dir = folderPath(project.folders ?? [], file.folderId);
  return dir ? `${dir}/${file.name}` : file.name;
}

function deploymentJson(project: Project): string {
  const d = project.deployResult;
  return JSON.stringify(
    {
      network: "preprod",
      contractAddress: d?.contractAddress ?? null,
      txHash: d?.transactionHash ?? null,
      blockHeight: d?.blockNumber ?? null,
      deployedAt: d?.success ? new Date().toISOString() : null,
      template: project.template,
      artifactBaseUrl: project.artifactBaseUrl ?? null,
    },
    null,
    2,
  );
}

const EXPORT_README = `# CompactLab export

This zip was exported from CompactLab IDE (Midnight Preprod).

## Contents
- Contract source (\`.compact\`) and project scaffold
- \`deployment.json\` — last deploy address (if any)
- \`contracts/managed/\` — ZK artifacts when this machine had a successful Compile

## Next steps
1. Install [Compact CLI](https://docs.midnight.network/) and run \`npm run compile\` if managed keys are missing.
2. Use [1AM](https://1am.xyz/) for proving and signing on Preprod.
3. Fund tDUST: https://faucet.preprod.midnight.network/

CompactLab Deploy/Call uses 1AM \`getProvingProvider\` — no Docker proof server.
`;

export async function exportProjectZip(project: Project): Promise<Blob> {
  const zip = new JSZip();
  const root = project.slug || "compact-project";

  for (const file of project.files) {
    if (file.name === "deployment.json" && !file.folderId) {
      zip.file(`${root}/deployment.json`, deploymentJson(project));
      continue;
    }
    zip.file(`${root}/${filePath(project, file)}`, file.content);
  }

  if (!project.files.some((f) => f.name === "deployment.json" && !f.folderId)) {
    zip.file(`${root}/deployment.json`, deploymentJson(project));
  }

  zip.file(`${root}/COMPACTLAB_EXPORT.md`, EXPORT_README);

  if (project.artifactBaseUrl) {
    try {
      const { apiFetch } = await import("@/lib/api");
      const res = await apiFetch(
        `/v1/artifacts?base=${encodeURIComponent(project.artifactBaseUrl)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          files?: Array<{ path: string; contentBase64: string }>;
        };
        for (const f of data.files ?? []) {
          const binary = Uint8Array.from(atob(f.contentBase64), (c) => c.charCodeAt(0));
          zip.file(`${root}/contracts/managed/${f.path}`, binary);
        }
      }
    } catch {
      /* managed folder optional — source export still useful */
    }
  }

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
