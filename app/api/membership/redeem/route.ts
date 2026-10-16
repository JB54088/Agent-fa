import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { hashActivationCode, isActivationCodeFormatValid, normalizeActivationCode } from "../../../../lib/membership/activation-code";
import { MEMBERSHIP_PLANS } from "../../../../lib/membership/plans";
import { getMembershipRemaining } from "../../../../lib/membership/status";

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user?.id) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  if (user.role === "admin") return NextResponse.json({ ok: false, error: "admin_membership_exempt" }, { status: 400 });

  const body = await request.json().catch(() => ({})) as { code?: unknown };
  const code = normalizeActivationCode(body.code);
  if (!isActivationCodeFormatValid(code)) return NextResponse.json({ ok: false, error: "activation_code_invalid" }, { status: 400 });

  try {
    const codeHash = hashActivationCode(code);
    const result = await getDb().execute(sql`
      WITH candidate AS MATERIALIZED (
        SELECT id, membership_started_at, membership_ends_at AS previous_end_at
        FROM public.users
        WHERE id = ${user.id}::uuid
          AND role = 'customer'
          AND status = 'active'
        FOR UPDATE
      ),
      claimed AS (
        UPDATE public.activation_codes AS code
        SET status = 'used', activated_by_user_id = ${user.id}::uuid, activated_at = NOW()
        FROM candidate
        WHERE code.code_hash = ${codeHash}
          AND code.status = 'unused'
        RETURNING code.id, code.plan, code.duration_days
      ), extended AS (
        UPDATE public.users AS account
        SET membership_started_at = CASE
              WHEN candidate.previous_end_at > NOW() THEN COALESCE(account.membership_started_at, NOW())
              ELSE NOW()
            END,
            membership_ends_at = GREATEST(COALESCE(candidate.previous_end_at, NOW()), NOW()) + make_interval(days => claimed.duration_days),
            membership_plan = claimed.plan,
            updated_at = NOW()
        FROM claimed, candidate
        WHERE account.id = candidate.id
          AND account.role = 'customer'
          AND account.status = 'active'
        RETURNING account.membership_ends_at AS new_end_at,
          candidate.previous_end_at,
          claimed.id AS activation_code_id,
          claimed.plan,
          claimed.duration_days
      ), recorded AS (
        INSERT INTO public.membership_transactions (user_id, activation_code_id, plan, duration_days, previous_end_at, new_end_at)
        SELECT ${user.id}::uuid, extended.activation_code_id, extended.plan, extended.duration_days, extended.previous_end_at, extended.new_end_at
        FROM extended
        RETURNING activation_code_id, plan, new_end_at
      )
      SELECT recorded.new_end_at, recorded.plan
      FROM recorded
    `);

    const redeemed = result.rows[0] as { new_end_at: string | Date; plan: string } | undefined;
    if (!redeemed) return NextResponse.json({ ok: false, error: "activation_code_invalid_or_used" }, { status: 409 });
    const endsAt = redeemed.new_end_at instanceof Date ? redeemed.new_end_at : new Date(redeemed.new_end_at);
    return NextResponse.json({
      ok: true,
      membership: {
        status: "active",
        membershipEndsAt: endsAt.toISOString(),
        currentPlan: redeemed.plan,
        remaining: getMembershipRemaining(endsAt),
      },
      message: `${MEMBERSHIP_PLANS[redeemed.plan as keyof typeof MEMBERSHIP_PLANS]?.label ?? "会员"}已激活`,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "membership_service_unavailable" }, { status: 503 });
  }
}
