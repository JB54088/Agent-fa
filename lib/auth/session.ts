import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "school_radar_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();
let runtimeSessionSecret: string | undefined;

/** Allows the Cloudflare Worker adapter to pass its secret binding explicitly. */
export function configureSessionSecret(secret: string | undefined) {
  if (secret && secret !== runtimeSessionSecret) runtimeSessionSecret = secret;
}

function sessionSecret() {
  const secret = runtimeSessionSecret ?? process.env.AUTH_SESSION_SECRET ?? process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is required");
  return secret;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string) {
  const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function verify(value: string, signature: string) {
  try {
    const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return await globalThis.crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(value));
  } catch {
    return false;
  }
}

export async function createSessionToken(userId: string) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS })));
  return `${payload}.${await sign(payload)}`;
}

export async function getSessionUserId() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !(await verify(payload, signature))) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { sub?: string; exp?: number };
    return data.sub && typeof data.exp === "number" && data.exp > Math.floor(Date.now() / 1000) ? data.sub : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set({ name: SESSION_COOKIE_NAME, value: await createSessionToken(userId), httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
