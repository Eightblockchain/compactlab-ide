/**
 * Server-side product config for local lab vs shared public hosting.
 */

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true" || v === "yes";
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const isProd = process.env.NODE_ENV === "production";

/** Shared public product mode (stricter defaults). */
export const isPublicProduct = envBool("COMPACTLAB_PUBLIC", isProd);

/**
 * Full ZK compile via Compact CLI on this host.
 * Off by default in public/production unless explicitly enabled —
 * compile shells out and is expensive.
 */
export const compileEnabled = envBool(
  "COMPACTLAB_ENABLE_COMPILE",
  !isPublicProduct,
);

/** HMAC secret for session cookies. Set in production. */
export const sessionSecret =
  process.env.COMPACTLAB_SESSION_SECRET ||
  (isPublicProduct ? "" : "dev-only-compactlab-session-secret");

export const rateLimits = {
  /** Requests per IP per minute for mutating APIs */
  apiPerMinute: envInt("COMPACTLAB_RATE_LIMIT_PER_MIN", isPublicProduct ? 30 : 120),
  /** Full ZK compiles per session per hour */
  zkCompilePerHour: envInt("COMPACTLAB_ZK_COMPILE_PER_HOUR", isPublicProduct ? 3 : 20),
  /** Skip-zk typechecks per session per hour */
  skipZkPerHour: envInt("COMPACTLAB_SKIP_ZK_PER_HOUR", isPublicProduct ? 60 : 300),
  /** Indexer proxy calls per IP per minute */
  indexerPerMinute: envInt("COMPACTLAB_INDEXER_PER_MIN", isPublicProduct ? 40 : 200),
};

/** On-disk managed ZK artifacts (not under public/). */
export function managedArtifactsRoot(): string {
  return (
    process.env.COMPACTLAB_DATA_DIR ||
    `${process.cwd()}/.data/contracts/managed`
  );
}

export function assertSessionSecretConfigured(): void {
  if (isPublicProduct && (!sessionSecret || sessionSecret === "dev-only-compactlab-session-secret")) {
    throw new Error(
      "COMPACTLAB_SESSION_SECRET must be set to a long random string when COMPACTLAB_PUBLIC=true",
    );
  }
}
