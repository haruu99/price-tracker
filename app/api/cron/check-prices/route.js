import { NextResponse } from "next/server";
import { runDueChecks } from "@/lib/tracker-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const querySecret = new URL(request.url).searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  if (expected && headerSecret !== expected && querySecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const batchSize = Math.max(1, Number(process.env.CHECK_BATCH_SIZE || 10));
    const result = await runDueChecks(batchSize);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cron run failed."
      },
      { status: 500 }
    );
  }
}
