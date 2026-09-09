import test from "node:test";
import assert from "node:assert/strict";

const { hashPassword, verifyPassword } = await import("../lib/auth/password.ts");
const { hasAdminRole } = await import("../lib/auth/admin.ts");

test("only an authenticated admin identity passes the admin authorization boundary", () => {
  assert.equal(hasAdminRole({ id: "admin-id", role: "admin" }), true);
  assert.equal(hasAdminRole({ id: "customer-id", role: "customer" }), false);
  assert.equal(hasAdminRole({ id: "admin-id", role: "customer" }), false);
  assert.equal(hasAdminRole({ role: "admin" }), false);
  assert.equal(hasAdminRole(null), false);
});

test("passwords are stored as salted PBKDF2 hashes", async () => {
  const encoded = await hashPassword("Test-Password-2026!");
  assert.match(encoded, /^pbkdf2_sha256_2x\$100000\$[^$]+\$[^$]+$/);
  assert.notEqual(encoded, "Test-Password-2026!");
  assert.equal(await verifyPassword("Test-Password-2026!", encoded), true);
  assert.equal(await verifyPassword("wrong-password", encoded), false);
});

test("short passwords are rejected before hashing", async () => {
  await assert.rejects(() => hashPassword("short"), /password_too_short/);
});
