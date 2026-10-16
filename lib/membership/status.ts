export type MembershipStatus = "admin" | "active" | "trial" | "expired";
export const MEMBERSHIP_TRIAL_HOURS = 72;

export type MembershipIdentity = {
  role?: string | null;
  trialStartedAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  membershipEndsAt?: Date | string | null;
};

function timestamp(value: Date | string | null | undefined): number {
  if (!value) return Number.NaN;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function getMembershipStatus(user: MembershipIdentity, now = new Date()): MembershipStatus {
  if (user.role === "admin") return "admin";
  const nowMs = now.getTime();
  if (timestamp(user.membershipEndsAt) > nowMs) return "active";
  if (timestamp(user.trialEndsAt) > nowMs) return "trial";
  return "expired";
}

export function createTrialWindow(startedAt = new Date()) {
  const endsAt = new Date(startedAt.getTime() + MEMBERSHIP_TRIAL_HOURS * 60 * 60 * 1000);
  return { trialStartedAt: new Date(startedAt), trialEndsAt: endsAt };
}

export function getMembershipRemaining(endAt: Date | string | null | undefined, now = new Date()) {
  const endMs = timestamp(endAt);
  const totalMinutes = Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - now.getTime()) / 60_000)) : 0;
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes - days * 24 * 60) / 60);
  const minutes = totalMinutes - days * 24 * 60 - hours * 60;
  return { days, hours, minutes, totalMinutes };
}

export function isMembershipEnforcementEnabled(value = process.env.MEMBERSHIP_ENFORCEMENT_ENABLED) {
  return value === "true";
}

export function hasMembershipAccess(user: MembershipIdentity, enforcementEnabled = isMembershipEnforcementEnabled()) {
  const status = getMembershipStatus(user);
  return status === "admin" || !enforcementEnabled || status === "active" || status === "trial";
}
