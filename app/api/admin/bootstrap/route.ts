import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb, schema } from "../../../../db";

async function currentAdmin(userEmail: string) {
  const db = getDb();
  const rows = await db.select({ userId: schema.users.id, role: schema.adminUsers.role })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, userEmail))
    .limit(1);
  return rows[0] ?? null;
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
    const db = getDb();
    const admin = await currentAdmin(user.email);
    const anyAdmin = await db.select({ userId: schema.adminUsers.userId }).from(schema.adminUsers).limit(1);
    return NextResponse.json({ ok: true, isAdmin: Boolean(admin), role: admin?.role ?? null, canBootstrap: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理员初始化检查失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function POST() {
  try {
    return NextResponse.json({ ok: false, error: "admin_creation_cli_only" }, { status: 403 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理员初始化失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
