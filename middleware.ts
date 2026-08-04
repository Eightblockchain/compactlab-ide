import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "compactlab_sid";

function secret(): string {
  return (
    process.env.COMPACTLAB_SESSION_SECRET ||
    (process.env.COMPACTLAB_PUBLIC === "true" || process.env.NODE_ENV === "production"
      ? ""
      : "dev-only-compactlab-session-secret")
  );
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const s = secret();
  if (!s) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(s),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

async function mint(): Promise<string> {
  const idBytes = new Uint8Array(24);
  crypto.getRandomValues(idBytes);
  let id = "";
  for (let i = 0; i < idBytes.length; i++) id += String.fromCharCode(idBytes[i]!);
  const idB64 = btoa(id).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${idB64}.${await sign(idB64)}`;
}

async function valid(token: string | undefined): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  const s = secret();
  if (!s) return false;
  const [id, sig] = token.split(".");
  if (!id || !sig) return false;
  const expected = await sign(id);
  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Edge middleware: session cookie + reject API if public secret missing. */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const isPublic =
    process.env.COMPACTLAB_PUBLIC === "true" || process.env.NODE_ENV === "production";

  if (isPublic && !secret()) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error:
            "Server misconfigured: set COMPACTLAB_SESSION_SECRET for public CompactLab.",
        },
        { status: 503 },
      );
    }
  }

  const current = req.cookies.get(SESSION_COOKIE)?.value;
  if (!(await valid(current)) && secret()) {
    const token = await mint();
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  res.headers.set("X-CompactLab-Mode", isPublic ? "public" : "local");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|contracts/).*)"],
};
