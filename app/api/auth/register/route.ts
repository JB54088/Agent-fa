import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "../../../../db";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../../../../lib/auth/password";
import { setSessionCookie } from "../../../../lib/auth/session";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

function accountEmail(phone: string) {
  return `${phone}@accounts.school-recruitment-radar.invalid`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const phone = String(body.phone ?? "").replace(/\s+/g, "");
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
    if (body.role !== undefined || body.is_admin !== undefined || body.admin !== undefined || body.permissions !== undefined || body.user_type !== undefined) {
      return NextResponse.json({ ok: false, error: "role_must_not_be_submitted" }, { status: 400 });
    }
    if (!PHONE_PATTERN.test(phone)) return NextResponse.json({ ok: false, error: "invalid_mainland_phone" }, { status: 400 });
    if (password.length < PASSWORD_MIN_LENGTH) return NextResponse.json({ ok: false, error: "password_too_short" }, { status: 400 });
    if (password !== confirmPassword) return NextResponse.json({ ok: false, error: "password_confirmation_mismatch" }, { status: 400 });

    const db = getDb();
    const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
    if (existing[0]) return NextResponse.json({ ok: false, error: "phone_already_registered" }, { status: 409 });
    const passwordHash = await hashPassword(password);
    const inserted = await db.insert(schema.users).values({
      email: accountEmail(phone),
      phone,
      passwordHash,
      role: "customer",
      status: "active",
      trialStartedAt: sql`now()`,
      trialEndsAt: sql`now() + interval '72 hours'`,
    }).returning({ id: schema.users.id });
    const userId = inserted[0]?.id;
    if (!userId) return NextResponse.json({ ok: false, error: "user_creation_failed" }, { status: 503 });
    await setSessionCookie(userId);
    return NextResponse.json({ ok: true, user: { id: userId, phone, name: phone, role: "customer" } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "注册失败";
    if (/unique|duplicate/i.test(message)) return NextResponse.json({ ok: false, error: "phone_already_registered" }, { status: 409 });
    console.error("[auth/register] request failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined,
    });
    return NextResponse.json({ ok: false, error: "registration_unavailable" }, { status: 503 });
  }
}
