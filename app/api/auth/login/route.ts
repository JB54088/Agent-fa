import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "../../../../db";
import { verifyPassword } from "../../../../lib/auth/password";
import { setSessionCookie } from "../../../../lib/auth/session";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { phone?: unknown; password?: unknown };
    const phone = String(body.phone ?? "").replace(/\s+/g, "");
    const password = typeof body.password === "string" ? body.password : "";
    if (!PHONE_PATTERN.test(phone)) return NextResponse.json({ ok: false, error: "invalid_mainland_phone" }, { status: 400 });
    const db = getDb();
    const rows = await db.select({ id: schema.users.id, phone: schema.users.phone, name: schema.users.name, email: schema.users.email, role: schema.users.role, status: schema.users.status, passwordHash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
    const account = rows[0];
    const passwordMatches = account ? await verifyPassword(password, account.passwordHash) : false;
    const hashParts = account?.passwordHash?.split("$") ?? [];
    console.log(JSON.stringify({ event: "auth_login_check", accountFound: Boolean(account), accountStatus: account?.status ?? null, hasPasswordHash: Boolean(account?.passwordHash), passwordHashLength: account?.passwordHash?.length ?? 0, passwordLength: password.length, hashParts: hashParts.length, hashAlgorithm: hashParts[0] ?? null, hashIterations: hashParts[1] ?? null, saltLength: hashParts[2]?.length ?? 0, digestLength: hashParts[3]?.length ?? 0, passwordMatches }));
    if (!account || account.status !== "active" || !passwordMatches) return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    await db.update(schema.users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(schema.users.id, account.id));
    await setSessionCookie(account.id);
    return NextResponse.json({ ok: true, user: { id: account.id, phone: account.phone, name: account.name, role: account.role } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "登录失败" }, { status: 503 });
  }
}
