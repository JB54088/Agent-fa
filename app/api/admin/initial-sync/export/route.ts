import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../../db";
import { initialSyncExport } from "../../../../../lib/collection/initial-sync";

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  const rows = await db.select({ userId: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return rows[0]?.userId ?? null;
}

function csvCell(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const rawKind = new URL(request.url).searchParams.get("kind");
    const kind = rawKind === "failed" || rawKind === "current" ? rawKind : "no-current";
    const rows = await initialSyncExport(neon(getDatabaseUrl()), kind);
    const records = rows as unknown as Array<Record<string, unknown>>;
    const headers = records.length ? Object.keys(records[0]) : kind === "failed"
      ? ["organization_name", "category", "province", "official_url", "failure_type", "last_checked_at", "retry_count", "next_action"]
      : kind === "current"
        ? ["organization", "title", "category", "season", "graduation_year", "publication_date", "application_start", "application_deadline", "region", "official_announcement_url", "official_application_url", "source_level", "last_verified_at", "publication_status"]
        : ["organization_name", "official_recruitment_url", "last_checked_at", "next_check_at"];
    const body = [headers.map(csvCell).join(","), ...records.map((record) => headers.map((header) => csvCell(record[header])).join(","))].join("\n");
    const filename = kind === "failed" ? "failed-sources.csv" : kind === "current" ? "current-recruitments.csv" : "no-current-recruitment.csv";
    return new Response(`\ufeff${body}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INITIAL_SYNC清单导出失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
