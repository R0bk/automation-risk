import { NextResponse } from "next/server";
import { recordRunPopularity } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    await recordRunPopularity(runId);

    return NextResponse.json({ success: true }, {
      headers: {
        // NEVER cache view counting
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.warn("Failed to record view", { error });
    // Don't fail the request if view counting fails
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
