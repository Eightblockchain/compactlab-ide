import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ProjectSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(100000),
  template: z.string().optional(),
});

// Mock in-memory store (replace with Prisma in production)
const projects: Record<string, { id: string; name: string; code: string; template?: string; createdAt: string; updatedAt: string }> = {};

export async function GET() {
  return NextResponse.json({ projects: Object.values(projects) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = ProjectSchema.parse(body);

    const id = Math.random().toString(36).slice(2, 11);
    const now = new Date().toISOString();
    const project = { id, ...data, createdAt: now, updatedAt: now };
    projects[id] = project;

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
