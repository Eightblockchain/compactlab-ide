import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exec } from "child_process";
import { writeFile, mkdir, readFile, rm, mkdtemp } from "fs/promises";
import { tmpdir, homedir } from "os";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

const CompileRequestSchema = z.object({
  code: z.string().min(1).max(50000),
  projectId: z.string().optional(),
});

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

  // Format: "Exception: filename line N char M:\n  message"
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

// ─── Smart mock fallback ──────────────────────────────────────────────────────

function smartMockCompile(code: string, start: number) {
  const hasPragma = /pragma language_version/.test(code);
  const hasExportedCircuit = /export\s+circuit\s+\w+/.test(code);
  const hasLedger = /export\s+ledger\s+\w+/.test(code);

  if (!hasExportedCircuit && !hasLedger) {
    return NextResponse.json({
      success: false,
      duration: Date.now() - start,
      errors: [
        {
          line: 1,
          column: 1,
          message: "No exported circuits or ledger declarations found.",
          severity: "error",
        },
      ],
    });
  }

  const circuitMatches = [...code.matchAll(/export\s+circuit\s+(\w+)\s*\(([^)]*)\)/g)];
  const circuitMetadata = circuitMatches.map((m) => {
    const name = m[1];
    const paramsStr = m[2].trim();
    const inputs = paramsStr
      ? paramsStr.split(",").map((p) => {
          const parts = p.trim().split(":");
          return { name: parts[0]?.trim() ?? "param", type: parts[1]?.trim() ?? "unknown" };
        })
      : [];
    return { name, inputs, output: "[]", constraints: 150, isExported: true };
  });

  const warnings: string[] = [];
  if (!hasPragma) warnings.push("Missing `pragma language_version` declaration");

  return NextResponse.json({
    success: true,
    duration: Date.now() - start,
    constraintCount: circuitMetadata.length * 150,
    circuitMetadata,
    warnings,
    mock: true,
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = CompileRequestSchema.parse(body);
    const start = Date.now();

    const compactBin = await findCompactBinary();

    if (compactBin) {
      const tmpDir = await mkdtemp(join(tmpdir(), "compactlab-"));
      const inputFile = join(tmpDir, "contract.compact");
      const outputDir = join(tmpDir, "output");

      try {
        await writeFile(inputFile, code, "utf-8");
        await mkdir(outputDir, { recursive: true });

        try {
          // --skip-zk: skip proof key generation — fast syntax+type check only
          await execAsync(
            `"${compactBin}" compile +0.30.0 --skip-zk "${inputFile}" "${outputDir}"`,
            { timeout: 30000 }
          );

          const infoPath = join(outputDir, "compiler", "contract-info.json");
          const infoJson = JSON.parse(await readFile(infoPath, "utf-8"));

          const circuitMetadata = (infoJson.circuits ?? []).map((c: {
            name: string;
            arguments?: Array<{ name: string; type?: { tsType?: string; "type-name"?: string } }>;
            "result-type"?: { "type-name"?: string };
          }) => ({
            name: c.name,
            inputs: (c.arguments ?? []).map((a) => ({
              name: a.name,
              type: a.type?.tsType ?? a.type?.["type-name"] ?? "unknown",
            })),
            output: c["result-type"]?.["type-name"] ?? "[]",
            constraints: 0,
            isExported: true,
          }));

          // Read generated output files to expose in the project tree
          type GeneratedFile = { name: string; language: "json" | "javascript" | "typescript"; content: string };
          const generatedFiles: GeneratedFile[] = [];
          const candidates: Array<[string, string, GeneratedFile["language"]]> = [
            [join(outputDir, "compiler", "contract-info.json"), "contract-info.json", "json"],
            [join(outputDir, "contract", "index.js"), "index.js", "javascript"],
            [join(outputDir, "contract", "index.d.ts"), "index.d.ts", "typescript"],
          ];
          for (const [filePath, name, language] of candidates) {
            try {
              const content = await readFile(filePath, "utf-8");
              generatedFiles.push({ name, language, content });
            } catch {
              // file may not exist with --skip-zk
            }
          }

          return NextResponse.json({
            success: true,
            duration: Date.now() - start,
            constraintCount: circuitMetadata.length * 100,
            circuitMetadata,
            compilerVersion: infoJson["compiler-version"] as string,
            languageVersion: infoJson["language-version"] as string,
            warnings: [],
            mock: false,
            generatedFiles,
          });
        } catch (execError) {
          const err = execError as { stderr?: string; stdout?: string };
          const errorOutput = (err.stderr ?? "") + (err.stdout ?? "");
          const errors = parseCompilerErrors(errorOutput);

          return NextResponse.json({
            success: false,
            duration: Date.now() - start,
            errors,
            mock: false,
          });
        }
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    // Compiler not found — use smart mock
    return smartMockCompile(code, start);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
