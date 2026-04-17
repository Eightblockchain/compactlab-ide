import { NextRequest, NextResponse } from "next/server";

const PROOF_SERVER_URL =
  process.env.PROOF_SERVER_URL ?? "http://localhost:6300";

/**
 * Proxy POST /api/proof/check → http://localhost:6300/check
 *
 * Proxying server-side avoids browser CORS restrictions when the proof server
 * (port 6300) is on a different origin than the DApp (port 3000).
 */
export async function POST(req: NextRequest) {
  const body = await req.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(`${PROOF_SERVER_URL}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Cannot reach proof server at ${PROOF_SERVER_URL}: ${msg}` },
      { status: 503 }
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `Proof server /check returned ${upstream.status}: ${text}` },
      { status: upstream.status }
    );
  }

  const result = await upstream.arrayBuffer();
  return new NextResponse(result, {
    headers: { "Content-Type": "application/octet-stream" },
  });
}
