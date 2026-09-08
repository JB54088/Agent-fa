import { and, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";

type SqlClient = ReturnType<typeof neon>;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OFFLINE_REASONS = ["招聘已结束", "官网链接失效", "页面不存在 / 404", "重复招聘", "信息错误", "非官方来源", "其他"] as const;
const PERMANENT_DELETE_REASONS = new Set(["重复招聘", "测试数据", "明显错误数据"]);

async function requireAdmin() {
  const user = await getAppUser();
  if (!user?.id || user.role !== "admin") return null;
  const db = getDb();
  const rows = await db.select({ userId: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(and(eq(schema.users.id, user.id), eq(schema.users.status, "active"), eq(schema.users.role, "admin")))
    .limit(1);
  const account = rows[0];
  if (!account) return null;

  // users.role is the canonical authority. Keep admin_users as a compatibility
  // mapping for older admin endpoints, but do not let a missing/stale mapping
  // prevent the current admin from using moderation actions.
  await db.insert(schema.adminUsers)
    .values({ userId: account.userId, role: "admin" })
    .onConflictDoUpdate({ target: schema.adminUsers.userId, set: { role: "admin", updatedAt: new Date() } });
  return account;
}

function moderationLog(action: string, details: Record<string, unknown>) {
  console.info(`[Recruitment ${action}]`, details);
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
    opportunityType: text(row.opportunity_type),
    recruitmentSeason: text(row.recruitment_season),
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
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
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
               o.opportunity_type, o.recruitment_season, o.updated_at,
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
                 o.opportunity_type, o.recruitment_season, o.updated_at,
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
          WHERE o.publication_status IN ('draft', 'pending_review', 'approved', 'published', 'rejected', 'offline', 'withdrawn')
          ORDER BY o.updated_at DESC
        `
      : await sql`
          SELECT o.id::text AS id, o.title, o.display_type, o.batch_name,
                 o.official_announcement_url, o.official_application_url,
                 o.opportunity_type, o.recruitment_season, o.updated_at,
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
    const status = new URL(request.url).searchParams.get("status") ?? "published";
    const items = await listOpportunities(sql, status);
    return NextResponse.json({ ok: true, status, items, offlineReasons: OFFLINE_REASONS, permanentDeleteReasons: [...PERMANENT_DELETE_REASONS] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Recruitment Moderation Read Failed]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "正式招聘读取失败" }, { status: 500 });
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
    const reason = body.reason?.trim() ?? "";
    if (action === "offline" && !OFFLINE_REASONS.includes(reason as (typeof OFFLINE_REASONS)[number])) return NextResponse.json({ ok: false, error: "offline_reason_required" }, { status: 400 });
    if (action === "delete" && !PERMANENT_DELETE_REASONS.has(reason)) return NextResponse.json({ ok: false, error: "permanent_delete_reason_not_allowed" }, { status: 400 });

    let updatedCount = 0;
    let skippedCount = 0;
    const updatedIds: string[] = [];
    const skipped: string[] = [];
    for (const id of ids) {
      const current = await sql`SELECT id::text AS id, publication_status, offline_reason FROM opportunities WHERE id = ${id} LIMIT 1`;
      const row = current[0];
      if (!row) { skippedCount += 1; skipped.push(`${id}:记录不存在`); continue; }

      moderationLog(action === "offline" ? "Offline" : action === "restore" ? "Restore" : action === "reverify" ? "Reverify" : "Delete", {
        userId: admin.userId,
        role: "admin",
        opportunityId: id,
        oldStatus: String(row.publication_status),
        newStatus: action === "offline" ? "offline" : action === "restore" ? "published" : String(row.publication_status),
      });

      if (action === "offline") {
        if (row.publication_status !== "published") { skippedCount += 1; skipped.push(`${id}:不是正式招聘`); continue; }
        const changed = await sql`
          WITH changed AS (
            UPDATE opportunities
            SET publication_status = 'offline', offline_reason = ${reason}, offline_at = now(), offline_by = ${admin.userId}, updated_at = now()
            WHERE id = ${id} AND publication_status = 'published'
            RETURNING id
          ), logged AS (
            INSERT INTO audit_logs (action, opportunity_id, operator, reason)
            SELECT 'offline', id, ${admin.email}, ${reason} FROM changed
            RETURNING opportunity_id
          )
          SELECT changed.id::text AS id FROM changed JOIN logged ON logged.opportunity_id = changed.id
        `;
        if (changed.length) { updatedCount += 1; updatedIds.push(id); moderationLog("Offline Updated", { opportunityId: id, affectedRows: changed.length, newStatus: "offline" }); }
        else { skippedCount += 1; skipped.push(`${id}:状态已变化，请重新读取列表`); }
      } else if (action === "restore") {
        if (!["offline", "withdrawn"].includes(String(row.publication_status))) { skippedCount += 1; skipped.push(`${id}:不是已下架记录`); continue; }
        const changed = await sql`
          WITH changed AS (
            UPDATE opportunities
            SET publication_status = 'published', offline_reason = NULL, offline_at = NULL, offline_by = NULL, updated_at = now()
            WHERE id = ${id} AND publication_status IN ('offline', 'withdrawn')
            RETURNING id
          ), logged AS (
            INSERT INTO audit_logs (action, opportunity_id, operator, reason)
            SELECT 'restore', id, ${admin.email}, '恢复上架' FROM changed
            RETURNING opportunity_id
          )
          SELECT changed.id::text AS id FROM changed JOIN logged ON logged.opportunity_id = changed.id
        `;
        if (changed.length) { updatedCount += 1; updatedIds.push(id); moderationLog("Restore Updated", { opportunityId: id, affectedRows: changed.length, newStatus: "published" }); }
        else { skippedCount += 1; skipped.push(`${id}:状态已变化，请重新读取列表`); }
      } else if (action === "reverify") {
        if (row.publication_status !== "published") { skippedCount += 1; skipped.push(`${id}:不是正式招聘`); continue; }
        const changed = await sql`
          WITH changed AS (
            UPDATE opportunities
            SET verification_status = 'needs_review', official_page_status = 'unknown', next_verify_at = now(), updated_at = now()
            WHERE id = ${id} AND publication_status = 'published'
            RETURNING id
          ), logged AS (
            INSERT INTO audit_logs (action, opportunity_id, operator, reason)
            SELECT 'mark_reverify', id, ${admin.email}, '批量重新核验官方链接' FROM changed
            RETURNING opportunity_id
          )
          SELECT changed.id::text AS id FROM changed JOIN logged ON logged.opportunity_id = changed.id
        `;
        if (changed.length) { updatedCount += 1; updatedIds.push(id); moderationLog("Reverify Updated", { opportunityId: id, affectedRows: changed.length, newStatus: String(row.publication_status) }); }
        else { skippedCount += 1; skipped.push(`${id}:状态已变化，请重新读取列表`); }
      } else if (action === "delete") {
        if (!["offline", "withdrawn"].includes(String(row.publication_status))) { skippedCount += 1; skipped.push(`${id}:必须先下架`); continue; }
        if (!PERMANENT_DELETE_REASONS.has(String(row.offline_reason))) { skippedCount += 1; skipped.push(`${id}:下架原因不允许永久删除`); continue; }
        await deleteOpportunityChildren(sql, id, admin.email, reason);
        updatedCount += 1;
        updatedIds.push(id);
      } else {
        return NextResponse.json({ ok: false, error: "unsupported_action" }, { status: 400 });
      }
    }
    return NextResponse.json({ ok: true, action, updatedCount, updatedIds, skippedCount, skipped });
  } catch (error) {
    console.error("[Recruitment Moderation Failed]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "正式招聘操作失败" }, { status: 500 });
  }
}
