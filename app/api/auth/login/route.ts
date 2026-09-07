import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "../../../../db";
import { verifyPassword } from "../../../../lib/auth/password";
import { setSessionCookie } from "../../../../lib/auth/session";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

function configuredAdminPhones() {
  return [process.env.ADMIN_PHONE_1, process.env.ADMIN_PHONE_2, process.env.ADMIN_PHONE_3]
    .map((phone) => (phone ?? "").replace(/\s+/g, ""))
    .filter(Boolean);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { phone?: unknown; password?: unknown };
    const phone = String(body.phone ?? "").replace(/\s+/g, "");
    const password = typeof body.password === "string" ? body.password : "";
    if (!PHONE_PATTERN.test(phone)) return NextResponse.json({ ok: false, error: "invalid_mainland_phone" }, { status: 400 });
    const db = getDb();
    const rows = await db.select({ id: schema.users.id, phone: schema.users.phone, name: schema.users.name, email: schema.users.email, role: schema.users.role, status: schema.users.status, passwordHash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
    const account = rows[0];
    if (!account || account.status !== "active" || !(await verifyPassword(password, account.passwordHash))) return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    const adminPhones = configuredAdminPhones();
    const hasCompleteAdminAllowlist = adminPhones.length === 3 && new Set(adminPhones).size === 3;
    const role = hasCompleteAdminAllowlist ? (adminPhones.includes(phone) ? "admin" : "customer") : account.role;
    await db.update(schema.users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(schema.users.id, account.id));
    if (role !== account.role) await db.update(schema.users).set({ role, updatedAt: new Date() }).where(eq(schema.users.id, account.id));
    if (hasCompleteAdminAllowlist && role === "admin") {
      await db.insert(schema.adminUsers).values({ userId: account.id, role: "admin" }).onConflictDoUpdate({ target: schema.adminUsers.userId, set: { role: "admin", updatedAt: new Date() } });
    }
    await setSessionCookie(account.id);
    return NextResponse.json({ ok: true, user: { id: account.id, phone: account.phone, name: account.name, role } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "登录失败" }, { status: 503 });
  }
}
