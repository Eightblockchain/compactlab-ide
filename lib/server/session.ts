import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sessionSecret, assertSessionSecretConfigured } from "@/lib/server/config";
import { rateLimit } from "@/lib/server/rate-limit";

export const SESSION_COOKIE = "compactlab_sid";

function sign(payload: string): string {
  assertSessionSecretConfigured();
  return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token || !token.includes(".")) return null;
  try {
    assertSessionSecretConfigured();
  } catch {
    return null;
  }
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  const expected = sign(id);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return id;
}

/**
 * Read session id minted by middleware.
 * Does not set cookies (Edge middleware owns minting).
 */
export async function requireSessionId(): Promise<string> {
  const jar = await cookies();
  const id = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!id) {
    throw new Error("SESSION_REQUIRED");
  }
  return id;
}

/** Quota check keyed by session (e.g. zk compiles / hour). */
export function sessionQuota(
  sessionId: string,
  kind: string,
  limit: number,
  windowMs: number,
) {
  return rateLimit(`sess:${kind}:${sessionId}`, limit, windowMs);
}
