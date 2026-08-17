import { NextResponse } from "next/server";
import { runIncrementalSync } from "../../../../lib/collection/incremental-sync";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runIncrementalSync({ triggerType: "cron_endpoint" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "增量同步失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
