import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({
      ok: true,
      database: "connected",
      service: "school-recruitment-radar",
      mode: "database-backed",
      message: "正式招聘数据由数据库提供；采集数据必须经过人工审核。",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据库不可用";
    return NextResponse.json({
      ok: false,
      database: "unavailable",
      error: message,
      service: "school-recruitment-radar",
      mode: "database-backed",
      message: "数据库尚未连接，前台不会使用静态招聘数据替代。",
    }, { status: 503 });
  }
}
