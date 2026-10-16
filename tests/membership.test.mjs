import test from "node:test";
import assert from "node:assert/strict";

const { createTrialWindow, getMembershipStatus, getMembershipRemaining, hasMembershipAccess, isMembershipEnforcementEnabled, MEMBERSHIP_TRIAL_HOURS } = await import("../lib/membership/status.ts");
const { MEMBERSHIP_PLANS } = await import("../lib/membership/plans.ts");
const { decryptActivationCode, encryptActivationCode, generateActivationCode, hashActivationCode, isActivationCodeFormatValid, normalizeActivationCode } = await import("../lib/membership/activation-code.ts");

const now = new Date("2026-10-10T00:00:00.000Z");

test("membership status grants admin first, then paid time, then trial", () => {
  assert.equal(getMembershipStatus({ role: "admin" }, now), "admin");
  assert.equal(getMembershipStatus({ role: "customer", membershipEndsAt: "2026-10-11T00:00:00.000Z", trialEndsAt: "2026-10-12T00:00:00.000Z" }, now), "active");
  assert.equal(getMembershipStatus({ role: "customer", trialEndsAt: "2026-10-10T00:00:01.000Z" }, now), "trial");
  assert.equal(getMembershipStatus({ role: "customer", trialEndsAt: "2026-10-10T00:00:00.000Z" }, now), "expired");
});

test("new account trial window lasts exactly 72 hours", () => {
  const { trialStartedAt, trialEndsAt } = createTrialWindow(now);
  assert.equal(MEMBERSHIP_TRIAL_HOURS, 72);
  assert.equal(trialStartedAt.toISOString(), now.toISOString());
  assert.equal(trialEndsAt.getTime() - trialStartedAt.getTime(), 72 * 60 * 60 * 1000);
});

test("remaining time is display-only and decomposes into days, hours, and minutes", () => {
  assert.deepEqual(getMembershipRemaining("2026-10-11T01:02:00.000Z", now), { days: 1, hours: 1, minutes: 2, totalMinutes: 1502 });
  assert.deepEqual(getMembershipRemaining("2026-10-09T23:59:00.000Z", now), { days: 0, hours: 0, minutes: 0, totalMinutes: 0 });
});

test("fixed membership plan prices and durations are centralized", () => {
  assert.deepEqual(Object.values(MEMBERSHIP_PLANS).map(({ price, durationDays, prefix }) => [price, durationDays, prefix]), [[9.9, 30, "M"], [19.9, 90, "Q"], [29.9, 365, "Y"]]);
});

test("activation code format uses secure random symbols and normalizes pasted code", () => {
  for (const plan of Object.keys(MEMBERSHIP_PLANS)) {
    const code = generateActivationCode(plan);
    assert.equal(isActivationCodeFormatValid(code), true);
    assert.equal(/[0O1IL]/.test(code.slice(2)), false);
    assert.equal(code[0], MEMBERSHIP_PLANS[plan].prefix);
    assert.equal(hashActivationCode(code), hashActivationCode(code.toLowerCase()));
  }
  assert.equal(normalizeActivationCode(" m‐abcd‐2345 "), "M-ABCD-2345");
  assert.equal(isActivationCodeFormatValid("M-ABCD-1OIL"), false);
});

test("activation code ciphertext can be retrieved for support without storing plaintext", () => {
  process.env.ACTIVATION_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const code = "M-ABCD-2345";
  const encrypted = encryptActivationCode(code);
  assert.match(encrypted, /^v1:/);
  assert.equal(encrypted.includes(code), false);
  assert.equal(decryptActivationCode(encrypted), code);
});

test("membership enforcement is opt-in until explicitly enabled", () => {
  assert.equal(isMembershipEnforcementEnabled("false"), false);
  assert.equal(isMembershipEnforcementEnabled(undefined), false);
  assert.equal(isMembershipEnforcementEnabled("true"), true);
});

test("membership authorization exempts admins and flag-off users, but blocks expired customers", () => {
  const futureTrialEnd = new Date(Date.now() + 60_000).toISOString();
  const pastTrialEnd = new Date(Date.now() - 60_000).toISOString();
  assert.equal(hasMembershipAccess({ role: "admin" }, true), true);
  assert.equal(hasMembershipAccess({ role: "customer", trialEndsAt: futureTrialEnd }, true), true);
  assert.equal(hasMembershipAccess({ role: "customer", trialEndsAt: pastTrialEnd }, false), true);
  assert.equal(hasMembershipAccess({ role: "customer", trialEndsAt: pastTrialEnd }, true), false);
});
