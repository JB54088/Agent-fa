import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";

/** Readiness checks the database separately from process liveness. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true, service: "school-recruitment-radar", check: "ready", database: "connected" });
  } catch (error) {
    return NextResponse.json({ ok: false, service: "school-recruitment-radar", check: "ready", database: "unavailable", error: error instanceof Error ? error.message : "数据库不可用" }, { status: 503 });
  }
}
