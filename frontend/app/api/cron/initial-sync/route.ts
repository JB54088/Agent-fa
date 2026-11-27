import { NextResponse } from "next/server";
import { runBatch1 } from "../../admin/initial-sync/route";

export async function POST(request: Request) {
  const expected = process.env.INITIAL_SYNC_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    // This endpoint is intentionally scoped to BATCH 1. Later batches require
    // a separate, explicit implementation and are not reachable here.
    return NextResponse.json(await runBatch1(null));
  } catch (error) {
    const message = error instanceof Error ? error.message : "BATCH 1 执行失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
