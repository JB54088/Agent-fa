import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";

const OPEN_STATUSES = ["pending", "in_review"] as const;
const ALLOWED_STATUSES = ["pending", "in_review", "resolved", "rejected"] as const;

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  const rows = await db.select({ userId: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return rows[0] ?? null;
}

async function ensureCorrectionTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS "user_correction_reports" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
      "user_id" uuid REFERENCES "users"("id"),
      "reporter_email" text,
      "type" text NOT NULL,
      "content" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "reviewed_by" uuid REFERENCES "users"("id"),
      "reviewed_at" timestamptz,
      "admin_note" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "user_correction_reports_status_idx" ON "user_correction_reports" ("status", "created_at")`;
  await sql`CREATE INDEX IF NOT EXISTS "user_correction_reports_opportunity_idx" ON "user_correction_reports" ("opportunity_id", "created_at")`;
}

function normalize(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    await ensureCorrectionTable(sql);
    const status = new URL(request.url).searchParams.get("status") ?? "all";
    const rows = status === "open"
      ? await sql`
          SELECT r.id::text AS id, r.opportunity_id::text AS opportunity_id, r.type, r.content, r.status,
                 r.reporter_email, r.created_at, r.reviewed_at, r.admin_note,
                 o.title, org.name AS company, org.short_name, o.official_announcement_url,
                 o.official_application_url, ds.source_url
          FROM user_correction_reports r
          JOIN opportunities o ON o.id = r.opportunity_id
          LEFT JOIN organizations org ON org.id = o.organization_id
          LEFT JOIN data_sources ds ON ds.id = o.source_id
          WHERE r.status IN ('pending', 'in_review')
          ORDER BY r.created_at DESC
        `
      : await sql`
          SELECT r.id::text AS id, r.opportunity_id::text AS opportunity_id, r.type, r.content, r.status,
                 r.reporter_email, r.created_at, r.reviewed_at, r.admin_note,
                 o.title, org.name AS company, org.short_name, o.official_announcement_url,
                 o.official_application_url, ds.source_url
          FROM user_correction_reports r
          JOIN opportunities o ON o.id = r.opportunity_id
          LEFT JOIN organizations org ON org.id = o.organization_id
          LEFT JOIN data_sources ds ON ds.id = o.source_id
          ORDER BY r.created_at DESC
        `;
    return NextResponse.json({ ok: true, items: rows.map((row) => ({
      id: String(row.id), opportunityId: String(row.opportunity_id), type: String(row.type), content: String(row.content), status: String(row.status),
      reporterEmail: row.reporter_email ? String(row.reporter_email) : null, createdAt: new Date(String(row.created_at)).toISOString(), reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : null,
      adminNote: row.admin_note ? String(row.admin_note) : "", title: String(row.title ?? "未命名招聘项目"), company: String(row.company ?? "待匹配企业"),
      officialUrl: row.official_application_url ?? row.official_announcement_url ?? row.source_url ?? null,
    })), openCount: rows.filter((row) => OPEN_STATUSES.includes(String(row.status) as (typeof OPEN_STATUSES)[number])).length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "纠错列表读取失败" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { id?: string; status?: string; adminNote?: string };
    const id = normalize(body.id);
    const status = normalize(body.status);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "correction_id_required" }, { status: 400 });
    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) return NextResponse.json({ ok: false, error: "correction_status_invalid" }, { status: 400 });
    const sql = neon(getDatabaseUrl());
    await ensureCorrectionTable(sql);
    const result = await sql`
      UPDATE user_correction_reports
      SET status = ${status}, admin_note = ${normalize(body.adminNote) || null}, reviewed_by = ${admin.userId}, reviewed_at = now(), updated_at = now()
      WHERE id = ${id}
      RETURNING id::text AS id
    `;
    if (!result.length) return NextResponse.json({ ok: false, error: "correction_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, id, status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "纠错处理失败" }, { status: 503 });
  }
}
