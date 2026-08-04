import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { rateLimits } from "@/lib/server/config";

const INDEXER_URL = "https://indexer.preprod.midnight.network/api/v3/graphql";

const RequestSchema = z.object({
  query: z.string().min(1).max(2000),
  variables: z.record(z.string(), z.unknown()).optional(),
  operationName: z.string().optional(),
});

/** Only allow CompactLab Contract UI queries — not arbitrary GraphQL. */
function isAllowedIndexerQuery(query: string): boolean {
  const q = query.replace(/\s+/g, " ").trim();
  if (q.length > 2000) return false;
  // Block mutations / schema introspection abuse
  if (/\bmutation\b/i.test(q) || /\b__schema\b/i.test(q) || /\b__type\b/i.test(q)) {
    return false;
  }
  // Must be a contractAction read
  if (!/\bcontractAction\s*\(/i.test(q)) return false;
  // Address must look like hex (contract id)
  const addr = q.match(/address\s*:\s*"([0-9a-fA-F]{64})"/);
  if (!addr) return false;
  return true;
}

/**
 * Proxy for the Midnight Preprod indexer GraphQL API.
 * Rate-limited + query allowlist for public hosting.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`indexer:${ip}`, rateLimits.indexerPerMinute, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { errors: [{ message: "Rate limit exceeded" }] },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }

    const body = RequestSchema.parse(await req.json());
    if (!isAllowedIndexerQuery(body.query)) {
      return NextResponse.json(
        {
          errors: [
            {
              message:
                "Query not allowed. CompactLab only proxies contractAction(address: \"<64-hex>\") reads.",
            },
          ],
        },
        { status: 400, headers: rateLimitHeaders(rl) },
      );
    }

    const upstream = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: body.query }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await upstream.json();
    return NextResponse.json(data, {
      status: upstream.status,
      headers: rateLimitHeaders(rl),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ errors: [{ message: "Invalid request" }] }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
