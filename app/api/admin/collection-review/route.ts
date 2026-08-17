import { and, desc, eq, inArray } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";
import { syncFavoriteOpportunityReminders } from "../../../../lib/reminders/store";

const uiStatusToDb = {
  "待审核": "pending",
  "审核中": "in_review",
  "已转正式": "converted",
  "已驳回": "rejected",
  "暂不处理": "snoozed",
} as const;

async function stableUuid(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const chars = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

async function promoteReviewedItem(rawId: string, adminId: string, note: string | undefined) {
  const sql = neon(getDatabaseUrl());
  const rows = await sql`
    SELECT r.id::text AS raw_id, r.original_title, r.original_content, r.source_url,
           r.published_at, r.review_status, s.level AS source_level,
           s.id::text AS source_id, s.name AS source_name,
           st.id::text AS staging_id, st.organization_id::text AS organization_id,
           st.company_name, st.project_name, st.opportunity_type,
           st.recruitment_season, st.recruitment_year, st.recruitment_batch,
           st.graduation_years, st.degree_requirements, st.original_major_text,
           st.work_locations, st.published_at AS staging_published_at,
           st.start_at, st.deadline, st.announcement_url, st.application_url,
           st.deadline_type, st.review_status AS staging_review_status,
           o.name AS organization_name
    FROM raw_source_items r
    JOIN data_sources s ON s.id = r.data_source_id
    LEFT JOIN staging_opportunities st ON st.raw_source_item_id = r.id
    LEFT JOIN organizations o ON o.id = st.organization_id
    WHERE r.id = ${rawId}
    LIMIT 1
  `;
  const item = rows[0] as Record<string, unknown> | undefined;
  if (!item) throw new Error("raw_item_not_found");
  if (item.source_level === "D级") throw new Error("D级来源不得直接发布，请先补充更高等级官方来源或特别确认");
  if (!item.staging_id || !item.organization_id || !item.project_name) throw new Error("staging_opportunity_incomplete");
  if (!item.announcement_url && !item.application_url) throw new Error("official_source_url_required");

  const duplicate = await sql`
    SELECT id::text AS id FROM opportunities
    WHERE organization_id = ${String(item.organization_id)}
      AND title = ${String(item.project_name)}
      AND COALESCE(recruitment_year, 0) = COALESCE(${item.recruitment_year ? Number(item.recruitment_year) : null}, 0)
      AND (official_announcement_url = ${item.announcement_url ?? null} OR official_application_url = ${item.application_url ?? null})
    LIMIT 1
  `;
  if (duplicate[0]?.id) {
    await sql`
      UPDATE raw_source_items SET review_status = 'converted', duplicate_status = 'confirmed', error_message = ${note ?? "与正式机会重复，未覆盖原数据。"}, reviewed_by = ${adminId}, reviewed_at = now(), updated_at = now() WHERE id = ${rawId}
    `;
    await sql`UPDATE staging_opportunities SET review_status = 'DUPLICATE', reviewer_note = ${note ?? "与正式机会重复，未覆盖原数据。"}, reviewed_by = ${adminId}, reviewed_at = now(), updated_at = now() WHERE id = ${String(item.staging_id)}`;
    await sql`UPDATE admin_tasks SET status = 'completed', resolution = 'duplicate', completed_at = now(), updated_at = now() WHERE raw_source_item_id = ${rawId} AND status <> 'completed'`;
    return { status: "duplicate", opportunityId: String(duplicate[0].id) };
  }

  const opportunityId = await stableUuid(`review-promoted-opportunity:${rawId}`);
  const calculatedStatus = String(item.project_name).includes("即将") ? "upcoming" : "recruiting";
  await sql`
    INSERT INTO opportunities (
      id, title, organization_id, opportunity_type, recruitment_season,
      recruitment_year, target_graduation_years, batch_name, description,
      work_locations, education_requirements, degree_requirements,
      major_requirement_text, official_announcement_url, official_application_url,
      source_id, source_level, verification_status, last_verified_at,
      verified_by, next_verify_at, official_page_status, publication_status,
      calculated_status, manual_status, deadline_type, deadline_at,
      opportunity_relevance_status, data_credibility, is_demo
    ) VALUES (
      ${opportunityId}, ${String(item.project_name)}, ${String(item.organization_id)}, ${String(item.opportunity_type ?? "ENTERPRISE_CAMPUS")}, ${item.recruitment_season ?? null},
      ${item.recruitment_year ? Number(item.recruitment_year) : null}, ${JSON.stringify(item.graduation_years ?? [])}::jsonb, ${item.recruitment_batch ?? null}, ${String(item.original_content ?? item.project_name)},
      ${JSON.stringify(item.work_locations ?? [])}::jsonb, ${JSON.stringify(item.degree_requirements ?? [])}::jsonb, ${JSON.stringify(item.degree_requirements ?? [])}::jsonb,
      ${String(item.original_major_text ?? "以官方岗位详情为准")}, ${item.announcement_url ?? null}, ${item.application_url ?? null},
      ${String(item.source_id)}, ${String(item.source_level)}, 'verified', now(), ${adminId}, now() + interval '1 day', 'accessible',
      'published', ${calculatedStatus}, ${calculatedStatus}, ${item.deadline_type ?? "NOT_ANNOUNCED"}, ${item.deadline ?? null},
      'CURRENT_OPEN', '已核验', false
    )
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`UPDATE raw_source_items SET promoted_opportunity_id = ${opportunityId}, review_status = 'converted', duplicate_status = 'not_duplicate', error_message = ${note ?? null}, reviewed_by = ${adminId}, reviewed_at = now(), updated_at = now() WHERE id = ${rawId}`;
  await sql`UPDATE staging_opportunities SET promoted_opportunity_id = ${opportunityId}, review_status = 'APPROVED', reviewer_note = ${note ?? "管理员审核通过，已进入正式招聘信息。"}, reviewed_by = ${adminId}, reviewed_at = now(), updated_at = now() WHERE id = ${String(item.staging_id)}`;
  await sql`UPDATE admin_tasks SET status = 'completed', resolution = 'published', completed_at = now(), updated_at = now() WHERE raw_source_item_id = ${rawId} AND status <> 'completed'`;
  await syncFavoriteOpportunityReminders(opportunityId);
  return { status: "published", opportunityId };
}

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

export async function GET() {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const db = getDb();
    const rows = await db.select({
      id: schema.rawSourceItems.id,
      title: schema.rawSourceItems.originalTitle,
      source: schema.dataSources.name,
      sourceUrl: schema.rawSourceItems.sourceUrl,
      collectedAt: schema.rawSourceItems.collectedAt,
      publishedAt: schema.rawSourceItems.publishedAt,
      parseStatus: schema.rawSourceItems.parseStatus,
      reviewStatus: schema.rawSourceItems.reviewStatus,
      duplicateStatus: schema.rawSourceItems.duplicateStatus,
      content: schema.rawSourceItems.originalContent,
      summary: schema.rawSourceItems.contentSummary,
      parser: schema.rawSourceItems.parserName,
      parserResult: schema.rawSourceItems.parserResult,
    }).from(schema.rawSourceItems)
      .leftJoin(schema.dataSources, eq(schema.rawSourceItems.dataSourceId, schema.dataSources.id))
      .where(inArray(schema.rawSourceItems.reviewStatus, ["pending", "in_review", "snoozed"]))
      .orderBy(desc(schema.rawSourceItems.collectedAt));

    return NextResponse.json({ ok: true, items: rows.map((row) => ({
      ...row,
      title: row.title ?? "未命名原始记录",
      source: row.source ?? "未登记数据源",
      collectedAt: row.collectedAt?.toISOString() ?? "",
      publishedAt: row.publishedAt?.toISOString() ?? "",
      parseStatus: row.parseStatus === "success" ? "成功" : row.parseStatus === "partial" ? "部分成功" : "失败",
      reviewStatus: row.reviewStatus === "pending" ? "待审核" : row.reviewStatus === "in_review" ? "审核中" : "暂不处理",
      duplicateStatus: row.duplicateStatus === "suspected" || row.duplicateStatus === "confirmed" ? "疑似重复" : row.duplicateStatus === "unique" || row.duplicateStatus === "not_duplicate" ? "唯一" : "待判断",
      content: row.content ?? "原始正文未保存。请打开官方来源人工核对。",
      summary: row.summary ?? "暂无解析摘要",
      parser: row.parser ?? "未命名解析器",
    })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "审核队列读取失败";
    return NextResponse.json({ ok: false, error: message, items: [] }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const body = await request.json() as { id?: string; status?: keyof typeof uiStatusToDb; note?: string };
    if (!body.id || !body.status || !uiStatusToDb[body.status]) return NextResponse.json({ ok: false, error: "invalid_review_action" }, { status: 400 });
    const db = getDb();
    if (body.status === "已转正式") {
      const promotion = await promoteReviewedItem(body.id, adminId, body.note);
      return NextResponse.json({ ok: true, id: body.id, status: body.status, promotion });
    }
    const updated = await db.update(schema.rawSourceItems).set({
      reviewStatus: uiStatusToDb[body.status],
      reviewedBy: adminId,
      reviewedAt: new Date(),
      errorMessage: body.note ?? null,
      updatedAt: new Date(),
    }).where(and(eq(schema.rawSourceItems.id, body.id))).returning({ id: schema.rawSourceItems.id });
    if (!updated.length) return NextResponse.json({ ok: false, error: "raw_item_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, id: body.id, status: body.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "审核操作失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
