import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, user: { displayName: user.displayName, email: user.email, fullName: user.fullName } });
}
