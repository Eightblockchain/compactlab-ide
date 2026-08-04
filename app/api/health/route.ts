import { NextResponse } from "next/server";
import { compileEnabled, isPublicProduct, rateLimits } from "@/lib/server/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "compactlab",
    mode: isPublicProduct ? "public" : "local",
    compileEnabled,
    rateLimits: {
      apiPerMinute: rateLimits.apiPerMinute,
      zkCompilePerHour: rateLimits.zkCompilePerHour,
      indexerPerMinute: rateLimits.indexerPerMinute,
    },
  });
}
