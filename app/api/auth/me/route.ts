import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";
import { getMembershipRemaining, getMembershipStatus, isMembershipEnforcementEnabled } from "../../../../lib/membership/status";

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ authenticated: false });
  const membershipStatus = getMembershipStatus(user);
  const membershipEnd = membershipStatus === "active" ? user.membershipEndsAt : user.trialEndsAt;
  return NextResponse.json({ authenticated: true, user: { id: user.id ?? null, displayName: user.displayName, email: user.email, fullName: user.fullName, phone: user.phone ?? null, role: user.role ?? null, membership: { status: membershipStatus, trialStartedAt: user.trialStartedAt ?? null, trialEndsAt: user.trialEndsAt ?? null, membershipEndsAt: user.membershipEndsAt ?? null, remaining: getMembershipRemaining(membershipEnd) }, membershipEnforcementEnabled: isMembershipEnforcementEnabled() } });
}
