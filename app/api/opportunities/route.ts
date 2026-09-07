import { NextResponse } from "next/server";
import { getAppUser } from "../../chatgpt-auth";
import { listPublishedProjects } from "../../../lib/opportunities";

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ ok: false, error: "authentication_required", projects: [] }, { status: 401 });
  try {
    const projects = await listPublishedProjects();
    return NextResponse.json({ ok: true, source: "database", projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据库读取失败";
    return NextResponse.json({ ok: false, source: "database", error: message, projects: [] }, { status: 503 });
  }
}
