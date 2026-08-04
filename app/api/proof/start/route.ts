import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL ?? "http://localhost:6300";
const IMAGE = "midnightntwrk/proof-server";

interface StartResult {
  started: boolean;
  alreadyRunning?: boolean;
  containerId?: string;
  error?: string;
}

/**
 * POST /api/proof/start
 *
 * Starts the Midnight proof server Docker container in detached mode.
 * Safe to call when already running — Docker will just report the conflict
 * and we catch + handle it as "already running".
 *
 * The client should poll GET /api/proof/health after this returns until
 * the server is ready (typically 5–15 seconds on first start).
 */
export async function POST(): Promise<NextResponse<StartResult>> {
  // First check if it's already up
  try {
    const res = await fetch(`${PROOF_SERVER_URL}/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(2_000),
    });
    if (res.ok || res.status < 500) {
      return NextResponse.json({ started: true, alreadyRunning: true });
    }
  } catch {
    // not running — continue to start it
  }

  // Check Docker is available
  try {
    await execAsync("docker info --format '{{.ServerVersion}}'");
  } catch {
    return NextResponse.json(
      { started: false, error: "Docker is not running or not installed. Install Docker Desktop from https://docker.com and start it." },
      { status: 503 },
    );
  }

  // Start the container
  try {
    const { stdout } = await execAsync(
      `docker run -d --rm -p 6300:6300 --name compactlab-proof-server ${IMAGE}`,
    );
    return NextResponse.json({ started: true, containerId: stdout.trim() });
  } catch (err) {
    const msg = err instanceof Error ? (err as { stderr?: string }).stderr ?? err.message : String(err);

    // Already running under the same name
    if (msg.includes("already in use") || msg.includes("Conflict")) {
      return NextResponse.json({ started: true, alreadyRunning: true });
    }

    // Image not pulled yet — pull then start
    if (msg.includes("Unable to find image") || msg.includes("pull")) {
      try {
        await execAsync(`docker pull ${IMAGE}`);
        const { stdout } = await execAsync(
          `docker run -d --rm -p 6300:6300 --name compactlab-proof-server ${IMAGE}`,
        );
        return NextResponse.json({ started: true, containerId: stdout.trim() });
      } catch (pullErr) {
        const pullMsg = pullErr instanceof Error ? pullErr.message : String(pullErr);
        return NextResponse.json(
          { started: false, error: `Failed to pull ${IMAGE}: ${pullMsg}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { started: false, error: msg },
      { status: 500 },
    );
  }
}
