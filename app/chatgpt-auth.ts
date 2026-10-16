import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { getSessionUserId } from "../lib/auth/session";

export type ChatGPTUser = {
  id?: string;
  displayName: string;
  email: string;
  fullName: string | null;
  phone?: string | null;
  role?: "admin" | "customer" | null;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  membershipPlan?: string | null;
  membershipEndsAt?: Date | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const appUser = await getAppUser();
  if (appUser) return appUser;
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

/**
 * Returns only the user authenticated by the app-owned phone/password session.
 * Business pages and APIs use this helper so a platform-provided identity
 * header can never grant access to recruitment data or admin operations.
 */
export async function getAppUser(): Promise<ChatGPTUser | null> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return null;
  try {
    const db = getDb();
    const rows = await db.select({ id: schema.users.id, email: schema.users.email, phone: schema.users.phone, role: schema.users.role, trialStartedAt: schema.users.trialStartedAt, trialEndsAt: schema.users.trialEndsAt, membershipPlan: schema.users.membershipPlan, membershipEndsAt: schema.users.membershipEndsAt })
      .from(schema.users)
      .where(and(eq(schema.users.id, sessionUserId), eq(schema.users.status, "active")))
      .limit(1);
    const account = rows[0];
    if (!account) return null;
    const configuredName = account.role === "admin" && account.phone === (process.env.ADMIN_PHONE_1 ?? "").replace(/\s+/g, "")
      ? process.env.ADMIN_NAME_1?.trim().slice(0, 80)
      : null;
    const displayName = configuredName || account.phone || account.email;
    return { id: account.id, displayName, email: account.email, fullName: configuredName ?? null, phone: account.phone, role: account.role, trialStartedAt: account.trialStartedAt, trialEndsAt: account.trialEndsAt, membershipPlan: account.membershipPlan, membershipEndsAt: account.membershipEndsAt };
  } catch {
    return null;
  }
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
