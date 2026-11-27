import { NextResponse } from "next/server";
import { getMembershipRemaining, getMembershipStatus, hasMembershipAccess, type MembershipIdentity } from "./status";

export function requireMembership(user: MembershipIdentity & { id?: string | null }) {
  if (!user.id) return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
  const status = getMembershipStatus(user);
  if (hasMembershipAccess(user)) return null;
  return NextResponse.json({
    ok: false,
    error: "MEMBERSHIP_REQUIRED",
    membership: {
      status,
      trialStartedAt: user.trialStartedAt ?? null,
      trialEndsAt: user.trialEndsAt ?? null,
      membershipEndsAt: user.membershipEndsAt ?? null,
      remaining: getMembershipRemaining(user.trialEndsAt),
    },
  }, { status: 403 });
}
