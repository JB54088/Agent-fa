import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";
import { hasAdminRole } from "../../../../lib/auth/admin";
import { getDb, schema } from "../../../../db";

export async function GET() {
  try {
    const user = await getAppUser();
    if (!user) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
    if (!hasAdminRole(user)) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });

    // users.role is the canonical authority. Recreate the legacy mapping so
    // the remaining admin endpoints continue to work for this account too.
    const db = getDb();
    await db.insert(schema.adminUsers)
      .values({ userId: user.id, role: "admin" })
      .onConflictDoUpdate({ target: schema.adminUsers.userId, set: { role: "admin", updatedAt: new Date() } });
    return NextResponse.json({ ok: true, isAdmin: true, role: "admin", canBootstrap: false });
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
