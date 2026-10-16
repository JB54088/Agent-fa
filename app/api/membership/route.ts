import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getAppUser } from "../../chatgpt-auth";
import { MEMBERSHIP_PLANS } from "../../../lib/membership/plans";
import { getMembershipRemaining, getMembershipStatus, isMembershipEnforcementEnabled } from "../../../lib/membership/status";

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });

  try {
    const now = new Date();
    const status = getMembershipStatus(user, now);
    const endsAt = status === "active" ? user.membershipEndsAt : user.trialEndsAt;
    const currentPlan = status === "active" ? user.membershipPlan ?? null : null;
    return NextResponse.json({
      ok: true,
      membership: {
        status,
        trialStartedAt: user.trialStartedAt?.toISOString() ?? null,
        trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
        membershipEndsAt: user.membershipEndsAt?.toISOString() ?? null,
        remaining: getMembershipRemaining(endsAt, now),
        currentPlan,
      },
      enforcementEnabled: isMembershipEnforcementEnabled(),
      plans: MEMBERSHIP_PLANS,
      customerService: {
        wechat: process.env.CUSTOMER_SERVICE_WECHAT?.trim() || null,
        qrAvailable: existsSync(join(process.cwd(), "public", "customer-service-wechat.png")),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "membership_schema_unavailable" }, { status: 503 });
  }
}
