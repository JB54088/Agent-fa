import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getDatabaseUrl } from "../../../../db";
import { ensureOfficialUrlLifecycle } from "../../../../lib/official-url-lifecycle";
import { syncAgentFaSources } from "../../../../lib/agent-fa-source-sync";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const sql = neon(getDatabaseUrl());
    await ensureOfficialUrlLifecycle(sql);
    const summary = await syncAgentFaSources(sql);
    return NextResponse.json({ ok: true, mode: "agent_fa_daily_sync", executedAt: new Date().toISOString(), summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent-fa 来源同步失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
