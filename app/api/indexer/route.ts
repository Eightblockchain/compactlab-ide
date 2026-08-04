import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const INDEXER_URL = "https://indexer.preprod.midnight.network/api/v3/graphql";

const RequestSchema = z.object({
  query: z.string().min(1).max(4000),
  variables: z.record(z.string(), z.unknown()).optional(),
  operationName: z.string().optional(),
});

/**
 * Proxy for the Midnight Preprod indexer GraphQL API.
 * Exists only to sidestep browser CORS restrictions on the indexer endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const body = RequestSchema.parse(await req.json());

    const upstream = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 10 s timeout for indexer queries
      signal: AbortSignal.timeout(10_000),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
