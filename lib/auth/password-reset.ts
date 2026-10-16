import { createHmac, timingSafeEqual } from "node:crypto";

export const PASSWORD_RESET_CODES_PER_HOUR = 5;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;

export function isPasswordResetEnabled() {
  return process.env.PASSWORD_RESET_ENABLED === "true";
}

function resetCodeSecret() {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is required");
  return secret;
}

export function hashPasswordResetCode(phone: string, code: string) {
  return createHmac("sha256", resetCodeSecret()).update(`${phone}\0${code}`, "utf8").digest("hex");
}

export function passwordResetCodeHashMatches(storedHash: unknown, submittedHash: string) {
  if (typeof storedHash !== "string" || !/^[a-f\d]{64}$/i.test(storedHash)) return false;
  const stored = Buffer.from(storedHash, "hex");
  const submitted = Buffer.from(submittedHash, "hex");
  return stored.length === submitted.length && timingSafeEqual(stored, submitted);
}
