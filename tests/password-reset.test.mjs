import test from "node:test";
import assert from "node:assert/strict";

const { hashPasswordResetCode, passwordResetCodeHashMatches } = await import("../lib/auth/password-reset.ts");

test("password reset codes are keyed hashes bound to the phone", () => {
  process.env.AUTH_SESSION_SECRET = "test-session-secret-not-for-production";
  const hash = hashPasswordResetCode("13800138000", "012345");
  assert.match(hash, /^[a-f\d]{64}$/);
  assert.notEqual(hash, "012345");
  assert.equal(passwordResetCodeHashMatches(hash, hash), true);
  assert.equal(passwordResetCodeHashMatches(hash, hashPasswordResetCode("13800138001", "012345")), false);
  assert.equal(passwordResetCodeHashMatches(hash, hashPasswordResetCode("13800138000", "012346")), false);
});
