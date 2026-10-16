export const MEMBERSHIP_PLANS = {
  monthly: { key: "monthly", label: "月卡", price: 9.9, priceCents: 990, durationDays: 30, prefix: "M" },
  quarterly: { key: "quarterly", label: "季度卡", price: 19.9, priceCents: 1990, durationDays: 90, prefix: "Q" },
  yearly: { key: "yearly", label: "年卡", price: 29.9, priceCents: 2990, durationDays: 365, prefix: "Y" },
} as const;

export type MembershipPlanKey = keyof typeof MEMBERSHIP_PLANS;
export type MembershipPackage = (typeof MEMBERSHIP_PLANS)[MembershipPlanKey];

export function isMembershipPlanKey(value: unknown): value is MembershipPlanKey {
  return typeof value === "string" && Object.hasOwn(MEMBERSHIP_PLANS, value);
}
