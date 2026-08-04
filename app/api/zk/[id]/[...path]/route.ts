import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { managedArtifactsRoot } from "@/lib/server/config";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { rateLimits } from "@/lib/server/config";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 16 * 1024 * 1024;

function contentType(filePath: string): string {
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".wasm")) return "application/wasm";
  if (filePath.endsWith(".d.ts") || filePath.endsWith(".ts")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "private, max-age=60",
  };
}

/** OPTIONS — wallet / SW CORS preflight */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/**
 * GET /api/zk/[id]/[...path]
 * Serves managed ZK artifacts from private .data/ (not public/).
 * Ids are unguessable session-scoped project ids; still rate-limited.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; path: string[] }> },
) {
  const ip = clientIp(req);
  const rl = rateLimit(`zk:${ip}`, rateLimits.apiPerMinute * 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { ...rateLimitHeaders(rl), ...corsHeaders() } },
    );
  }

  const { id, path: parts } = await ctx.params;
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safeId || safeId !== id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: corsHeaders() });
  }

  const relParts = (parts ?? []).map((p) => p.replace(/\\/g, "/"));
  if (relParts.length === 0 || relParts.some((p) => !p || p === ".." || p.includes(".."))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400, headers: corsHeaders() });
  }

  const root = path.resolve(managedArtifactsRoot(), safeId);
  const target = path.resolve(root, ...relParts);
  if (!target.startsWith(root + path.sep) && target !== root) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400, headers: corsHeaders() });
  }

  try {
    const st = await fs.stat(target);
    if (!st.isFile() || st.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders() });
    }
    const buf = await fs.readFile(target);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        ...corsHeaders(),
        ...rateLimitHeaders(rl),
        "Content-Type": contentType(target),
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders() });
  }
}
