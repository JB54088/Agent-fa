import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb, schema } from "../../../../db";
import { runIncrementalSync } from "../../../../lib/collection/incremental-sync";

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

export async function POST() {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    return NextResponse.json(await runIncrementalSync({ triggerType: "admin_manual" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "增量同步失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
