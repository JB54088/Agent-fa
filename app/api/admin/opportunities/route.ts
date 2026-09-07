import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";

type SqlClient = ReturnType<typeof neon>;

const OFFLINE_REASONS = ["招聘已结束", "官网链接失效", "页面不存在 / 404", "重复招聘", "信息错误", "非官方来源", "其他"] as const;
const PERMANENT_DELETE_REASONS = new Set(["重复招聘", "测试数据", "明显错误数据"]);

async function requireAdmin() {
  const user = await getAppUser();
  if (!user || user.role !== "admin") return null;
  const db = getDb();
  const rows = await db.select({ userId: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return rows[0] ?? null;
}

async function ensureModerationSchema(sql: SqlClient) {
  await sql`ALTER TYPE "publish_status" ADD VALUE IF NOT EXISTS 'offline'`;
  await sql`
    ALTER TABLE "opportunities"
      ADD COLUMN IF NOT EXISTS "offline_reason" text,
      ADD COLUMN IF NOT EXISTS "offline_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "offline_by" uuid REFERENCES "users"("id")
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "action" text NOT NULL,
      "opportunity_id" uuid,
      "operator" text NOT NULL,
      "reason" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "audit_logs_opportunity_idx" ON "audit_logs" ("opportunity_id", "created_at")`;
  await sql`CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action", "created_at")`;
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function mapOpportunity(row: Record<string, unknown>) {
  const announcementUrl = text(row.official_announcement_url);
  const applicationUrl = text(row.official_application_url);
  const sourceUrl = text(row.source_url) ?? text(row.list_page_url);
  return {
    id: String(row.id),
    title: text(row.title) ?? "未命名招聘项目",
    company: text(row.organization_name) ?? "待匹配企业",
    shortName: text(row.organization_short_name) ?? text(row.organization_name) ?? "招聘单位",
    batch: text(row.batch_name) ?? "公开招聘",
    displayType: text(row.display_type) === "OFFICIAL_RECRUITMENT_ENTRY" ? "OFFICIAL_RECRUITMENT_ENTRY" : "RECRUITMENT_PROJECT",
    sourceName: text(row.source_name) ?? "官方来源",
    sourceLevel: text(row.source_level) ?? "A级",
    sourceUrl,
    announcementUrl,
    applicationUrl,
    officialUrl: applicationUrl ?? announcementUrl ?? sourceUrl,
    publicationStatus: text(row.publication_status) ?? "published",
    verificationStatus: text(row.verification_status) ?? "unverified",
    officialPageStatus: text(row.official_page_status) ?? "unknown",
    lastVerifiedAt: row.last_verified_at ? new Date(String(row.last_verified_at)).toISOString() : null,
    offlineReason: text(row.offline_reason),
    offlineAt: row.offline_at ? new Date(String(row.offline_at)).toISOString() : null,
    offlineBy: text(row.offline_by_email) ?? text(row.offline_by),
    isDemo: row.is_demo === true,
  };
}

async function listOpportunities(sql: SqlClient, status: string) {
  const rows = status === "offline"
    ? await sql`
        SELECT o.id::text AS id, o.title, o.display_type, o.batch_name,
               o.official_announcement_url, o.official_application_url,
               o.publication_status, o.verification_status, o.official_page_status,
               o.last_verified_at, o.offline_reason, o.offline_at,
               o.offline_by::text AS offline_by,
               u.email AS offline_by_email, o.is_demo,
               org.name AS organization_name, org.short_name AS organization_short_name,
               ds.name AS source_name, ds.level AS source_level,
               ds.source_url, ds.list_page_url
        FROM opportunities o
        LEFT JOIN organizations org ON org.id = o.organization_id
        LEFT JOIN data_sources ds ON ds.id = o.source_id
        LEFT JOIN users u ON u.id = o.offline_by
        WHERE o.publication_status IN ('offline', 'withdrawn')
        ORDER BY o.offline_at DESC NULLS LAST, o.updated_at DESC
      `
    : status === "all"
      ? await sql`
          SELECT o.id::text AS id, o.title, o.display_type, o.batch_name,
                 o.official_announcement_url, o.official_application_url,
                 o.publication_status, o.verification_status, o.official_page_status,
                 o.last_verified_at, o.offline_reason, o.offline_at,
                 o.offline_by::text AS offline_by,
                 u.email AS offline_by_email, o.is_demo,
                 org.name AS organization_name, org.short_name AS organization_short_name,
                 ds.name AS source_name, ds.level AS source_level,
                 ds.source_url, ds.list_page_url
          FROM opportunities o
          LEFT JOIN organizations org ON org.id = o.organization_id
          LEFT JOIN data_sources ds ON ds.id = o.source_id
          LEFT JOIN users u ON u.id = o.offline_by
          WHERE o.publication_status IN ('published', 'offline', 'withdrawn')
          ORDER BY o.updated_at DESC
        `
      : await sql`
          SELECT o.id::text AS id, o.title, o.display_type, o.batch_name,
                 o.official_announcement_url, o.official_application_url,
                 o.publication_status, o.verification_status, o.official_page_status,
                 o.last_verified_at, o.offline_reason, o.offline_at,
                 o.offline_by::text AS offline_by,
                 u.email AS offline_by_email, o.is_demo,
                 org.name AS organization_name, org.short_name AS organization_short_name,
                 ds.name AS source_name, ds.level AS source_level,
                 ds.source_url, ds.list_page_url
          FROM opportunities o
          LEFT JOIN organizations org ON org.id = o.organization_id
          LEFT JOIN data_sources ds ON ds.id = o.source_id
          LEFT JOIN users u ON u.id = o.offline_by
          WHERE o.publication_status = 'published'
          ORDER BY o.updated_at DESC
        `;
  return rows.map((row) => mapOpportunity(row as Record<string, unknown>));
}

function idsFromBody(body: { opportunityId?: string; opportunityIds?: string[] }) {
  return [...new Set([...(Array.isArray(body.opportunityIds) ? body.opportunityIds : []), ...(body.opportunityId ? [body.opportunityId] : [])].filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
}

async function deleteOpportunityChildren(sql: SqlClient, opportunityId: string, operator: string, reason: string) {
  const queries = [
    sql`INSERT INTO audit_logs (action, opportunity_id, operator, reason) VALUES ('permanent_delete', ${opportunityId}, ${operator}, ${reason})`,
    sql`DELETE FROM opportunity_events WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_requirements WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_majors WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_regions WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_positions WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_favorites WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_application_trackers WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_reminder_settings WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_changes WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunity_major_rules WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM notification_deliveries WHERE opportunity_id = ${opportunityId}`,
    sql`DELETE FROM notifications WHERE opportunity_id = ${opportunityId}`,
    sql`UPDATE collection_review_tasks SET opportunity_id = NULL WHERE opportunity_id = ${opportunityId}`,
    sql`UPDATE raw_source_items SET promoted_opportunity_id = NULL WHERE promoted_opportunity_id = ${opportunityId}`,
    sql`UPDATE staging_opportunities SET promoted_opportunity_id = NULL WHERE promoted_opportunity_id = ${opportunityId}`,
    sql`DELETE FROM opportunities WHERE id = ${opportunityId}`,
  ];
  await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    await ensureModerationSchema(sql);
    const status = new URL(request.url).searchParams.get("status") ?? "published";
    const items = await listOpportunities(sql, status);
    return NextResponse.json({ ok: true, status, items, offlineReasons: OFFLINE_REASONS, permanentDeleteReasons: [...PERMANENT_DELETE_REASONS] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "正式招聘读取失败" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { action?: string; reason?: string; opportunityId?: string; opportunityIds?: string[] };
    const action = body.action;
    const ids = idsFromBody(body);
    if (!action || !ids.length) return NextResponse.json({ ok: false, error: "opportunity_ids_required" }, { status: 400 });
    const sql = neon(getDatabaseUrl());
    await ensureModerationSchema(sql);
    const reason = body.reason?.trim() ?? "";
    if (action === "offline" && !OFFLINE_REASONS.includes(reason as (typeof OFFLINE_REASONS)[number])) return NextResponse.json({ ok: false, error: "offline_reason_required" }, { status: 400 });
    if (action === "delete" && !PERMANENT_DELETE_REASONS.has(reason)) return NextResponse.json({ ok: false, error: "permanent_delete_reason_not_allowed" }, { status: 400 });

    let updatedCount = 0;
    let skippedCount = 0;
    const skipped: string[] = [];
    for (const id of ids) {
      const current = await sql`SELECT id::text AS id, publication_status, offline_reason FROM opportunities WHERE id = ${id} LIMIT 1`;
      const row = current[0];
      if (!row) { skippedCount += 1; skipped.push(`${id}:记录不存在`); continue; }

      if (action === "offline") {
        if (row.publication_status !== "published") { skippedCount += 1; skipped.push(`${id}:不是正式招聘`); continue; }
        await sql.transaction([
          sql`UPDATE opportunities SET publication_status = 'offline', offline_reason = ${reason}, offline_at = now(), offline_by = ${admin.userId}, updated_at = now() WHERE id = ${id} AND publication_status = 'published'`,
          sql`INSERT INTO audit_logs (action, opportunity_id, operator, reason) VALUES ('offline', ${id}, ${admin.email}, ${reason})`,
        ], { isolationLevel: "ReadCommitted" });
        updatedCount += 1;
      } else if (action === "restore") {
        if (!["offline", "withdrawn"].includes(String(row.publication_status))) { skippedCount += 1; skipped.push(`${id}:不是已下架记录`); continue; }
        await sql.transaction([
          sql`UPDATE opportunities SET publication_status = 'published', offline_reason = NULL, offline_at = NULL, offline_by = NULL, updated_at = now() WHERE id = ${id} AND publication_status IN ('offline', 'withdrawn')`,
          sql`INSERT INTO audit_logs (action, opportunity_id, operator, reason) VALUES ('restore', ${id}, ${admin.email}, '恢复上架')`,
        ], { isolationLevel: "ReadCommitted" });
        updatedCount += 1;
      } else if (action === "reverify") {
        if (row.publication_status !== "published") { skippedCount += 1; skipped.push(`${id}:不是正式招聘`); continue; }
        await sql.transaction([
          sql`UPDATE opportunities SET verification_status = 'needs_review', official_page_status = 'unknown', next_verify_at = now(), updated_at = now() WHERE id = ${id} AND publication_status = 'published'`,
          sql`INSERT INTO audit_logs (action, opportunity_id, operator, reason) VALUES ('mark_reverify', ${id}, ${admin.email}, '批量重新核验官方链接')`,
        ], { isolationLevel: "ReadCommitted" });
        updatedCount += 1;
      } else if (action === "delete") {
        if (!["offline", "withdrawn"].includes(String(row.publication_status))) { skippedCount += 1; skipped.push(`${id}:必须先下架`); continue; }
        if (!PERMANENT_DELETE_REASONS.has(String(row.offline_reason))) { skippedCount += 1; skipped.push(`${id}:下架原因不允许永久删除`); continue; }
        await deleteOpportunityChildren(sql, id, admin.email, reason);
        updatedCount += 1;
      } else {
        return NextResponse.json({ ok: false, error: "unsupported_action" }, { status: 400 });
      }
    }
    return NextResponse.json({ ok: true, action, updatedCount, skippedCount, skipped });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "正式招聘操作失败" }, { status: 503 });
  }
}
