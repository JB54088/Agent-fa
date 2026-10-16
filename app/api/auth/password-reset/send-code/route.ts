import { randomInt } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getDatabaseUrl } from "../../../../../db";
import { hashPasswordResetCode, isPasswordResetEnabled, PASSWORD_RESET_CODES_PER_HOUR } from "../../../../../lib/auth/password-reset";
import { AliyunSmsError, isAliyunSmsConfigured, sendVerificationCode } from "../../../../../lib/sms/aliyun-sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const GENERIC_RESPONSE = {
  ok: true,
  message: "如果该手机号已注册，验证码已发送；请在5分钟内完成验证。",
};

export async function POST(request: Request) {
  if (!isPasswordResetEnabled()) {
    return NextResponse.json({ ok: false, error: "password_reset_not_enabled" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const body = await request.json().catch(() => null) as { phone?: unknown } | null;
  const phone = typeof body?.phone === "string" ? body.phone.replace(/\s+/g, "") : "";
  if (!PHONE_PATTERN.test(phone)) {
    return NextResponse.json({ ok: false, error: "invalid_mainland_phone" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  // Check provider readiness before account lookup to avoid exposing whether a
  // phone is registered when production SMS credentials are unavailable.
  if (!isAliyunSmsConfigured()) {
    return NextResponse.json({ ok: false, error: "sms_service_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const sql = neon(getDatabaseUrl());
    const code = String(randomInt(100000, 1000000));
    const codeHash = hashPasswordResetCode(phone, code);
    const users = await sql`SELECT id FROM public.users WHERE phone = ${phone} AND status = 'active' LIMIT 1`;
    if (!users.length) return NextResponse.json(GENERIC_RESPONSE, { status: 202, headers: { "Cache-Control": "no-store" } });

    const [, inserted] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`password-reset:${phone}`}, 0))`,
      sql`
        INSERT INTO public.password_reset_codes (phone, code_hash, expires_at, attempts)
        SELECT ${phone}, ${codeHash}, now() + interval '5 minutes', 0
        WHERE NOT EXISTS (
          SELECT 1 FROM public.password_reset_codes
          WHERE phone = ${phone} AND created_at > now() - interval '60 seconds'
        )
        AND (
          SELECT count(*) FROM public.password_reset_codes
          WHERE phone = ${phone} AND created_at > now() - interval '1 hour'
        ) < ${PASSWORD_RESET_CODES_PER_HOUR}
        RETURNING id::text AS id
      `,
    ]);

    const resetCodeId = inserted[0]?.id;
    if (!resetCodeId) return NextResponse.json(GENERIC_RESPONSE, { status: 202, headers: { "Cache-Control": "no-store" } });

    try {
      const result = await sendVerificationCode(phone, code);
      console.info("[password-reset] verification SMS accepted", { requestId: result.requestId });
    } catch (error) {
      const smsError = error instanceof AliyunSmsError ? error : new AliyunSmsError("SMS_SEND_FAILED", null);
      console.error("[password-reset] verification SMS failed", { requestId: smsError.requestId, errorCode: smsError.errorCode });
      try {
        await sql`UPDATE public.password_reset_codes SET expires_at = now() WHERE id = ${resetCodeId}::uuid AND used_at IS NULL`;
      } catch {
        console.error("[password-reset] failed to expire undelivered code");
      }
    }

    // The same response is used for registered, unregistered, and
    // rate-limited phones to prevent account enumeration.
    return NextResponse.json(GENERIC_RESPONSE, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "password_reset_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
