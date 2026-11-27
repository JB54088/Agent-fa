import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../../backend/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
