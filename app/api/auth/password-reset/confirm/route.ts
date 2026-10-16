import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getDatabaseUrl } from "../../../../../db";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../../../../../lib/auth/password";
import {
  hashPasswordResetCode,
  isPasswordResetEnabled,
  PASSWORD_RESET_MAX_ATTEMPTS,
  passwordResetCodeHashMatches,
} from "../../../../../lib/auth/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const CODE_PATTERN = /^\d{6}$/;
const INVALID_CODE = { ok: false, error: "verification_code_invalid_or_expired" };

export async function POST(request: Request) {
  if (!isPasswordResetEnabled()) {
    return NextResponse.json({ ok: false, error: "password_reset_not_enabled" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const body = await request.json().catch(() => null) as {
    phone?: unknown;
    code?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  } | null;

  const phone = typeof body?.phone === "string" ? body.phone.replace(/\s+/g, "") : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (!PHONE_PATTERN.test(phone)) return NextResponse.json({ ok: false, error: "invalid_mainland_phone" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (!CODE_PATTERN.test(code)) return NextResponse.json(INVALID_CODE, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (newPassword.length < PASSWORD_MIN_LENGTH) return NextResponse.json({ ok: false, error: "password_too_short" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (newPassword !== confirmPassword) return NextResponse.json({ ok: false, error: "password_confirmation_mismatch" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  try {
    const sql = neon(getDatabaseUrl());
    const submittedHash = hashPasswordResetCode(phone, code);
    const latestRows = await sql`
      SELECT id::text AS id, code_hash, expires_at > now() AS is_unexpired,
        used_at IS NOT NULL AS is_used, attempts
      FROM public.password_reset_codes
      WHERE phone = ${phone}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;
    const latest = latestRows[0] as {
      id: string;
      code_hash: string;
      is_unexpired: boolean;
      is_used: boolean;
      attempts: number;
    } | undefined;

    if (!latest || !latest.is_unexpired || latest.is_used || latest.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      return NextResponse.json(INVALID_CODE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    if (!passwordResetCodeHashMatches(latest.code_hash, submittedHash)) {
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`password-reset:${phone}`}, 0))`,
        sql`
          WITH latest AS MATERIALIZED (
            SELECT id FROM public.password_reset_codes
            WHERE phone = ${phone}
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            FOR UPDATE
          )
          UPDATE public.password_reset_codes AS reset_code
          SET attempts = reset_code.attempts + 1
          FROM latest
          WHERE reset_code.id = latest.id
            AND reset_code.used_at IS NULL
            AND reset_code.expires_at > now()
            AND reset_code.attempts < ${PASSWORD_RESET_MAX_ATTEMPTS}
            AND reset_code.code_hash <> ${submittedHash}
        `,
      ]);
      return NextResponse.json(INVALID_CODE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const passwordHash = await hashPassword(newPassword);
    const updated = await sql`
      WITH phone_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(${`password-reset:${phone}`}, 0))
      ), latest AS MATERIALIZED (
        SELECT reset_code.id, reset_code.phone
        FROM public.password_reset_codes AS reset_code
        CROSS JOIN phone_lock
        WHERE reset_code.phone = ${phone}
        ORDER BY reset_code.created_at DESC, reset_code.id DESC
        LIMIT 1
        FOR UPDATE
      ), consumed AS (
        UPDATE public.password_reset_codes AS reset_code
        SET used_at = now(), attempts = reset_code.attempts + 1
        FROM latest
        WHERE reset_code.id = latest.id
          AND reset_code.code_hash = ${submittedHash}
          AND reset_code.used_at IS NULL
          AND reset_code.expires_at > now()
          AND reset_code.attempts < ${PASSWORD_RESET_MAX_ATTEMPTS}
        RETURNING reset_code.phone
      )
      UPDATE public.users AS account
      SET password_hash = ${passwordHash}, updated_at = now()
      FROM consumed
      WHERE account.phone = consumed.phone AND account.status = 'active'
      RETURNING account.id::text AS id
    `;

    if (!updated.length) return NextResponse.json(INVALID_CODE, { status: 400, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: true, message: "密码重置成功" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "password_reset_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
