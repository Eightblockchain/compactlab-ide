import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CompileRequestSchema = z.object({
  code: z.string().min(1).max(50000),
  projectId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = CompileRequestSchema.parse(body);

    // Mock compilation — in production, this would call the Compact SDK
    const hasContract = /contract\s+\w+/.test(code);
    const hasPragma = /pragma language_version/.test(code);

    if (!hasContract) {
      return NextResponse.json({
        success: false,
        errors: [{ line: 1, column: 1, message: "No contract declaration found", severity: "error" }],
        duration: 100,
      });
    }

    // Extract circuit names from code
    const circuitNames = [...code.matchAll(/export\s+circuit\s+(\w+)/g)].map((m) => m[1]);
    const constraintCount = circuitNames.length * 150 + Math.floor(Math.random() * 200);

    return NextResponse.json({
      success: true,
      constraintCount,
      duration: Math.floor(Math.random() * 800) + 400,
      circuitMetadata: circuitNames.map((name) => ({
        name,
        constraints: Math.floor(Math.random() * 200) + 50,
        isExported: true,
        inputs: [],
        output: "[]",
      })),
      warnings: !hasPragma ? ["Missing pragma language_version declaration"] : [],
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
