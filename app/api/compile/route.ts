import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exec } from "child_process";
import { COMPACT_COMPILER_PACKAGE } from "@/lib/version";
import { writeFile, mkdir, readFile, readdir, rm, mkdtemp, cp, stat } from "fs/promises";
import { tmpdir, homedir } from "os";
import { join } from "path";
import { promisify } from "util";
import {
  compileEnabled,
  managedArtifactsRoot,
  rateLimits,
} from "@/lib/server/config";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { requireSessionId, sessionQuota } from "@/lib/server/session";
import { managedAssetBase } from "@/lib/playground-assets";

const execAsync = promisify(exec);

const CompileRequestSchema = z.object({
  code: z.string().min(1).max(50000),
  projectId: z.string().optional(),
  /** When true, run full ZK compile (no --skip-zk) and persist artifacts. */
  zk: z.boolean().optional().default(false),
});

const COMPACT_INSTALL_HINT =
  "Install the Compact compiler: https://docs.midnight.network/ — then ensure `compact` is on your PATH (common locations: ~/.local/bin/compact, /usr/local/bin/compact, /opt/homebrew/bin/compact).";

// ─── Find compact binary ──────────────────────────────────────────────────────

async function findCompactBinary(): Promise<string | null> {
  const candidates = [
    join(homedir(), ".local/bin/compact"),
    "/usr/local/bin/compact",
    "/opt/homebrew/bin/compact",
  ];

  for (const candidate of candidates) {
    try {
      await execAsync(`"${candidate}" --version`, { timeout: 5000 });
      return candidate;
    } catch {
      // not found at this path
    }
  }

  try {
    await execAsync("compact --version", { timeout: 5000 });
    return "compact";
  } catch {
    return null;
  }
}

// ─── Parse compiler error output ─────────────────────────────────────────────

function parseCompilerErrors(output: string): Array<{ line: number; column: number; message: string; severity: "error" | "warning" }> {
  const errors: Array<{ line: number; column: number; message: string; severity: "error" | "warning" }> = [];

  const lineRegex = /(?:Exception:\s+)?[^\n]+\s+line\s+(\d+)\s+char\s+(\d+):\s*([\s\S]*?)(?=(?:Exception:|[^\n]+\s+line\s+\d+\s+char\s+\d+:|$))/g;
  let match;

  while ((match = lineRegex.exec(output)) !== null) {
    const message = match[3].trim();
    if (!message) continue;
    errors.push({
      line: parseInt(match[1], 10),
      column: parseInt(match[2], 10),
      message,
      severity: "error",
    });
  }

  if (errors.length === 0 && output.trim()) {
    errors.push({
      line: 1,
      column: 1,
      message: output.trim().replace(/^Exception:\s*/, ""),
      severity: "error",
    });
  }

  return errors;
}

type GeneratedFile = {
  path: string;
  name: string;
  language: "json" | "javascript" | "typescript" | "text";
  content: string;
};

async function collectGeneratedFiles(outputDir: string): Promise<GeneratedFile[]> {
  const generatedFiles: GeneratedFile[] = [];
  const EXT_LANG: Record<string, GeneratedFile["language"]> = {
    ".json": "json",
    ".js": "javascript",
    ".ts": "typescript",
    ".d.ts": "typescript",
  };
  // Binary ZK artifacts — include as stubs so the IDE tree shows keys/zkir
  const BINARY_EXT = new Set([".prover", ".verifier", ".bzkir", ".pk", ".vk"]);

  async function collectFiles(dir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await collectFiles(`${dir}/${entry.name}`, entryRel);
      } else {
        const lower = entry.name.toLowerCase();
        const ext = lower.endsWith(".d.ts")
          ? ".d.ts"
          : lower.lastIndexOf(".") >= 0
            ? lower.slice(lower.lastIndexOf("."))
            : "";
        if (ext === ".map") continue;

        const fullPath = `${dir}/${entry.name}`;
        if (
          BINARY_EXT.has(ext) ||
          entry.name.endsWith(".prover") ||
          entry.name.endsWith(".verifier")
        ) {
          // Compact keys are binary — stub so sidebar shows keys/storeMessage.prover etc.
          let size = 0;
          try {
            size = (await stat(fullPath)).size;
          } catch {
            /* ignore */
          }
          generatedFiles.push({
            path: entryRel,
            name: entry.name,
            language: "text",
            content:
              `# Binary Compact ZK artifact (${size} bytes)\n` +
              `# Not editable in the IDE — served from disk for the proof provider.\n` +
              `# Path relative to compile output: ${entryRel}\n`,
          });
          continue;
        }

        const language: GeneratedFile["language"] = EXT_LANG[ext] ?? "text";
        try {
          const content = await readFile(fullPath, "utf-8");
          if (content.includes("\0")) {
            generatedFiles.push({
              path: entryRel,
              name: entry.name,
              language: "text",
              content: `# Binary file (${content.length} bytes) — not shown as text\n`,
            });
            continue;
          }
          generatedFiles.push({ path: entryRel, name: entry.name, language, content });
        } catch {
          /* unreadable — skip */
        }
      }
    }
  }

  await collectFiles(outputDir, "");
  return generatedFiles;
}

function parseCircuitMetadata(infoJson: {
  circuits?: Array<{
    name: string;
    arguments?: Array<{ name: string; type?: { tsType?: string; "type-name"?: string } }>;
    "result-type"?: { "type-name"?: string };
  }>;
}) {
  return (infoJson.circuits ?? []).map((c) => ({
    name: c.name,
    inputs: (c.arguments ?? []).map((a) => ({
      name: a.name,
      type: a.type?.tsType ?? a.type?.["type-name"] ?? "unknown",
    })),
    output: c["result-type"]?.["type-name"] ?? "[]",
    constraints: 0,
    isExported: true,
  }));
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!compileEnabled) {
      return NextResponse.json(
        {
          success: false,
          duration: 0,
          error: "Compile is disabled on this host",
          installHint:
            "Public CompactLab disables server-side Compact CLI by default. Set COMPACTLAB_ENABLE_COMPILE=true on a hardened worker, or run locally with the Compact CLI for full ZK compile. Bundled Hello/Counter still Deploy without Compile.",
          errors: [
            {
              line: 1,
              column: 1,
              message:
                "Server-side Compile is disabled. Use Hello/Counter Instant Deploy, or enable COMPACTLAB_ENABLE_COMPILE on the host.",
              severity: "error",
            },
          ],
          mock: false,
        },
        { status: 403 },
      );
    }

    const ip = clientIp(req);
    const ipLimit = rateLimit(`compile-ip:${ip}`, rateLimits.apiPerMinute, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Try again shortly.", duration: 0 },
        { status: 429, headers: rateLimitHeaders(ipLimit) },
      );
    }

    const sessionId = await requireSessionId();
    const body = await req.json();
    const { code, projectId, zk } = CompileRequestSchema.parse(body);
    const start = Date.now();

    const quota = sessionQuota(
      sessionId,
      zk ? "zk" : "skipzk",
      zk ? rateLimits.zkCompilePerHour : rateLimits.skipZkPerHour,
      60 * 60 * 1000,
    );
    if (!quota.ok) {
      return NextResponse.json(
        {
          success: false,
          duration: Date.now() - start,
          error: zk
            ? `ZK compile quota exceeded (${rateLimits.zkCompilePerHour}/hour). Try later or Deploy a bundled template.`
            : `Typecheck quota exceeded (${rateLimits.skipZkPerHour}/hour).`,
          errors: [
            {
              line: 1,
              column: 1,
              message: "Compile quota exceeded for this session",
              severity: "error",
            },
          ],
          mock: false,
        },
        { status: 429, headers: rateLimitHeaders(quota) },
      );
    }

    const compactBin = await findCompactBinary();

    if (!compactBin) {
      return NextResponse.json(
        {
          success: false,
          duration: Date.now() - start,
          error: "Compact compiler not found",
          installHint: COMPACT_INSTALL_HINT,
          errors: [
            {
              line: 1,
              column: 1,
              message: `Compact compiler not found. ${COMPACT_INSTALL_HINT}`,
              severity: "error",
            },
          ],
          mock: false,
        },
        { status: 503 },
      );
    }

    const tmpDir = await mkdtemp(join(tmpdir(), "compactlab-"));
    const inputFile = join(tmpDir, "contract.compact");
    const outputDir = join(tmpDir, "output");

    try {
      await writeFile(inputFile, code, "utf-8");
      await mkdir(outputDir, { recursive: true });

      const skipZk = !zk;
      const timeout = zk ? 10 * 60_000 : 30_000;
      const flag = skipZk ? " --skip-zk" : "";

      try {
        await execAsync(
          `"${compactBin}" compile +${COMPACT_COMPILER_PACKAGE}${flag} "${inputFile}" "${outputDir}"`,
          { timeout },
        );

        const infoPath = join(outputDir, "compiler", "contract-info.json");
        const infoJson = JSON.parse(await readFile(infoPath, "utf-8"));
        const circuitMetadata = parseCircuitMetadata(infoJson);
        const generatedFiles = await collectGeneratedFiles(outputDir);

        // Inventory what the Compact compiler actually produced (per Midnight docs):
        // contract/, keys/, zkir/, compiler/
        async function listNames(subdir: string): Promise<string[]> {
          try {
            return (await readdir(join(outputDir, subdir))).filter((n) => !n.startsWith("."));
          } catch {
            return [];
          }
        }
        const artifacts = {
          skipZk,
          contract: await listNames("contract"),
          keys: await listNames("keys"),
          zkir: await listNames("zkir"),
          compiler: await listNames("compiler"),
        };

        let artifactBaseUrl: string | undefined;

        // Persist full ZK artifacts privately; serve via /api/zk/<id>/…
        if (zk) {
          const id = (projectId ?? `anon-${Date.now()}`)
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 64);
          const dest = join(managedArtifactsRoot(), id);
          await rm(dest, { recursive: true, force: true }).catch(() => {});
          await mkdir(dest, { recursive: true });
          await cp(outputDir, dest, { recursive: true });
          artifactBaseUrl = managedAssetBase(id);
        }

        const warnings: string[] = [];
        if (skipZk) {
          warnings.push(
            "Ran with --skip-zk: no proving/verifying keys were generated. Per Midnight docs this is for debugging JS/TS output only — not deployable ZK artifacts.",
          );
        } else if (artifacts.keys.length === 0) {
          warnings.push(
            "Full compile finished but keys/ is empty. Check Compact/zkir toolchain installation.",
          );
        }

        return NextResponse.json(
          {
            success: true,
            duration: Date.now() - start,
            constraintCount: undefined,
            circuitMetadata,
            compilerVersion: infoJson["compiler-version"] as string,
            languageVersion: infoJson["language-version"] as string,
            warnings,
            mock: false,
            skipZk,
            artifacts,
            generatedFiles,
            artifactBaseUrl,
            projectId: zk ? (projectId ?? undefined) : undefined,
            stdoutHint: skipZk
              ? "Typecheck/JS emit only (--skip-zk)"
              : `Full compile: keys=[${artifacts.keys.join(", ")}] zkir=[${artifacts.zkir.join(", ")}]`,
          },
          { headers: rateLimitHeaders(quota) },
        );
      } catch (execError) {
        const err = execError as { stderr?: string; stdout?: string; message?: string };
        const errorOutput = (err.stderr ?? "") + (err.stdout ?? "") || (err.message ?? "");
        const errors = parseCompilerErrors(errorOutput);

        return NextResponse.json({
          success: false,
          duration: Date.now() - start,
          errors: errors.length
            ? errors
            : [{ line: 1, column: 1, message: errorOutput || "Compilation failed", severity: "error" as const }],
          mock: false,
        });
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    if (err instanceof Error && err.message === "SESSION_REQUIRED") {
      return NextResponse.json(
        { success: false, error: "Session required. Refresh the page and retry.", duration: 0 },
        { status: 401 },
      );
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** GET — Compact CLI availability + whether this host allows compile. */
export async function GET() {
  const bin = await findCompactBinary();
  const base = {
    compileEnabled,
    publicMode:
      process.env.COMPACTLAB_PUBLIC === "true" || process.env.NODE_ENV === "production",
  };
  if (!bin) {
    return NextResponse.json(
      { ...base, available: false, installHint: COMPACT_INSTALL_HINT },
      { status: compileEnabled ? 503 : 200 },
    );
  }
  try {
    const { stdout } = await execAsync(`"${bin}" --version`, { timeout: 5000 });
    return NextResponse.json({
      ...base,
      available: true,
      version: stdout.trim(),
      compilerPackage: COMPACT_COMPILER_PACKAGE,
      path: bin,
    });
  } catch {
    return NextResponse.json({
      ...base,
      available: true,
      compilerPackage: COMPACT_COMPILER_PACKAGE,
      path: bin,
    });
  }
}
