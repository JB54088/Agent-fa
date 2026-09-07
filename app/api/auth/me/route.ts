import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, user: { id: user.id ?? null, displayName: user.displayName, email: user.email, fullName: user.fullName, phone: user.phone ?? null, role: user.role ?? null } });
}
