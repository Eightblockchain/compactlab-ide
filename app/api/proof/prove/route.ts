import { NextRequest, NextResponse } from "next/server";

const PROOF_SERVER_URL =
  process.env.PROOF_SERVER_URL ?? "http://localhost:6300";

/**
 * Proxy POST /api/proof/prove → http://localhost:6300/prove
 *
 * Proxying server-side avoids browser CORS restrictions when the proof server
 * (port 6300) is on a different origin than the DApp (port 3000).
 *
 * Note: this endpoint receives the full prover key + preimage in the request
 * body (built by ledger-v8's createProvingPayload). For hello-world the
 * prover key is ~22 KB — well within HTTP body limits.
 */
export async function POST(req: NextRequest) {
  const body = await req.arrayBuffer();

  let upstream: Response;
  try {
    // Proof generation can take several minutes for large circuits.
    // Without a timeout the browser request hangs indefinitely if the
    // proof server is slow or unresponsive.
    upstream = await fetch(`${PROOF_SERVER_URL}/prove`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body,
      signal: AbortSignal.timeout(5 * 60_000), // 5 minutes
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: isTimeout
          ? `Proof server at ${PROOF_SERVER_URL} did not respond within 5 minutes. Is it still running?`
          : `Cannot reach proof server at ${PROOF_SERVER_URL}: ${msg}` },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `Proof server /prove returned ${upstream.status}: ${text}` },
      { status: upstream.status }
    );
  }

  const result = await upstream.arrayBuffer();
  return new NextResponse(result, {
    headers: { "Content-Type": "application/octet-stream" },
  });
}
