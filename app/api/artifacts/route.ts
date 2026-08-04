import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { managedArtifactsRoot, rateLimits } from "@/lib/server/config";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const MAX_FILES = 200;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function safeManagedDir(base: string): string | null {
  // New: /api/zk/<id>  Legacy: /contracts/managed/<id>
  const m =
    base.match(/^\/api\/zk\/([a-zA-Z0-9_-]{1,64})$/) ||
    base.match(/^\/contracts\/managed\/([a-zA-Z0-9_-]{1,64})$/);
  if (!m) return null;
  return path.join(managedArtifactsRoot(), m[1]);
}

async function walk(
  dir: string,
  rel = "",
): Promise<Array<{ path: string; contentBase64: string }>> {
  const out: Array<{ path: string; contentBase64: string }> = [];
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (out.length >= MAX_FILES) break;
    if (name.startsWith(".")) continue;
    const abs = path.join(dir, name);
    const childRel = rel ? `${rel}/${name}` : name;
    const st = await fs.stat(abs);
    if (st.isDirectory()) {
      out.push(...(await walk(abs, childRel)));
    } else if (st.isFile()) {
      if (st.size > MAX_FILE_BYTES) continue;
      const buf = await fs.readFile(abs);
      out.push({ path: childRel, contentBase64: buf.toString("base64") });
    }
  }
  return out;
}

/** GET ?base=/api/zk/<id> — managed ZK files for project export (rate-limited). */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`artifacts:${ip}`, Math.max(5, Math.floor(rateLimits.apiPerMinute / 4)), 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const base = req.nextUrl.searchParams.get("base") ?? "";
  const dir = safeManagedDir(base);
  if (!dir) {
    return NextResponse.json(
      { error: "Invalid artifact base" },
      { status: 400, headers: rateLimitHeaders(rl) },
    );
  }
  const files = await walk(dir);
  return NextResponse.json({ base, files }, { headers: rateLimitHeaders(rl) });
}
