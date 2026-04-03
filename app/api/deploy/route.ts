import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DeploySchema = z.object({
  code: z.string().min(1),
  projectId: z.string().optional(),
  network: z.enum(["devnet", "testnet"]).default("devnet"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network } = DeploySchema.parse(body);

    // Simulate deployment delay
    await new Promise((r) => setTimeout(r, 100));

    const contractAddress = `0x${Math.random().toString(16).slice(2).padEnd(40, "0")}`;
    const transactionHash = `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`;

    return NextResponse.json({
      success: true,
      contractAddress,
      transactionHash,
      blockNumber: Math.floor(Math.random() * 10000) + 50000,
      gasUsed: Math.floor(Math.random() * 50000) + 10000,
      network,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
