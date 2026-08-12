import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../../db";
import { getInitialSyncProgress, type InitialSyncScope } from "../../../../../lib/collection/initial-sync";

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
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const scope = new URL(request.url).searchParams.get("scope") === "target_100" ? "target_100" : "monitoring";
    const progress = await getInitialSyncProgress(neon(getDatabaseUrl()), scope as InitialSyncScope);
    return NextResponse.json({ ok: true, mode: scope === "target_100" ? "TARGET_100_OFFICIAL_AUDIT" : "INITIAL_SYNC", progress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INITIAL_SYNC进度读取失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
