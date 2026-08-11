import { NextResponse } from "next/server";
import { listPublishedProjects } from "../../../lib/opportunities";

export async function GET() {
  try {
    const projects = await listPublishedProjects();
    return NextResponse.json({ ok: true, source: "database", projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据库读取失败";
    return NextResponse.json({ ok: false, source: "database", error: message, projects: [] }, { status: 503 });
  }
}
