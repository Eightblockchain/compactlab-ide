import { NextResponse } from "next/server";

const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL ?? "http://localhost:6300";

/**
 * GET /api/proof/health
 *
 * Quick reachability check for the local Docker proof server.
 * Returns 200 if the server responded to any request within 3 seconds,
 * or 503 if it is unreachable / timed out.
 *
 * The proof server has no documented health endpoint so we just try a HEAD
 * request to the root URL and accept any HTTP response as "reachable".
 */
export async function GET() {
  try {
    const resp = await fetch(`${PROOF_SERVER_URL}/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3_000),
    });
    return NextResponse.json(
      { ok: true, status: resp.status, url: PROOF_SERVER_URL },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: msg, url: PROOF_SERVER_URL },
      { status: 503 },
    );
  }
}
