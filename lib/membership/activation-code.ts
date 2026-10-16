import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { MEMBERSHIP_PLANS, type MembershipPlanKey } from "./plans.ts";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = /^[MQY]-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/;
const CIPHER_AAD = "school-recruitment-radar:activation-code:v1";

export function generateActivationCode(plan: MembershipPlanKey) {
  const prefix = MEMBERSHIP_PLANS[plan].prefix;
  const characters = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]);
  return `${prefix}-${characters.slice(0, 4).join("")}-${characters.slice(4).join("")}`;
}

export function normalizeActivationCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[‐‑‒–—]/g, "-").replace(/\s+/g, "") : "";
}

export function isActivationCodeFormatValid(value: unknown) {
  return CODE_PATTERN.test(normalizeActivationCode(value));
}

export function hashActivationCode(value: string) {
  return createHash("sha256").update(normalizeActivationCode(value), "utf8").digest("hex");
}

function encryptionKey() {
  const configured = process.env.ACTIVATION_CODE_ENCRYPTION_KEY;
  if (!configured) throw new Error("activation_code_encryption_key_required");
  const key = /^[a-f\d]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("activation_code_encryption_key_invalid");
  return key;
}

export function encryptActivationCode(code: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(Buffer.from(CIPHER_AAD));
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${nonce.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptActivationCode(value: string) {
  const [version, nonceText, tagText, ciphertextText] = value.split(":");
  if (version !== "v1" || !nonceText || !tagText || !ciphertextText) throw new Error("activation_code_ciphertext_invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(nonceText, "base64url"));
  decipher.setAAD(Buffer.from(CIPHER_AAD));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}
