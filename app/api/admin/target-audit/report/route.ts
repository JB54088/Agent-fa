import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../../db";
import { getInitialSyncProgress, targetAuditRows } from "../../../../../lib/collection/initial-sync";
import { ensureOfficialUrlLifecycle } from "../../../../../lib/official-url-lifecycle";

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  const rows = await db.select({ userId: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export async function GET() {
  try {
    if (!await requireAdmin()) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    await ensureOfficialUrlLifecycle(sql);
    const [progress, rows] = await Promise.all([
      getInitialSyncProgress(sql, "target_100"),
      targetAuditRows(sql),
    ]);
    return NextResponse.json({ ok: true, progress, rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "首批100家核验报告读取失败" }, { status: 503 });
  }
}
