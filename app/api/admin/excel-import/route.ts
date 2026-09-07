import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getAppUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";
import { excelImportDedupeKey, normalizeExcelImportRow, type ExcelImportInputRow, type NormalizedExcelImportRow } from "../../../../lib/excel-import";

type ImportRequest = {
  fileName?: string;
  headers?: string[];
  rows?: ExcelImportInputRow[];
};

async function requireAdmin() {
  const user = await getAppUser();
  if (!user) return null;
  const db = getDb();
  const rows = await db.select({ userId: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return rows[0]?.userId ?? null;
}
async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function sourceCategory(row: NormalizedExcelImportRow) {
  if (row.opportunityType === "CENTRAL_SOE") return "CENTRAL_SOE";
  if (row.opportunityType === "LOCAL_SOE") return "LOCAL_SOE";
  if (row.opportunityType === "NATIONAL_CIVIL_SERVICE") return "NATIONAL_CIVIL_SERVICE";
  if (row.opportunityType === "PROVINCIAL_CIVIL_SERVICE" || row.opportunityType === "SELECTED_GRADUATE") return "PROVINCIAL_CIVIL_SERVICE";
  if (row.opportunityType === "PUBLIC_INSTITUTION" || row.opportunityType === "MILITARY_CIVILIAN") return "GOVERNMENT";
  return "ENTERPRISE";
}

function organizationType(row: NormalizedExcelImportRow) {
  if (row.opportunityType === "CENTRAL_SOE") return "央企";
  if (row.opportunityType === "LOCAL_SOE") return "地方国企";
  if (["NATIONAL_CIVIL_SERVICE", "PROVINCIAL_CIVIL_SERVICE", "SELECTED_GRADUATE", "PUBLIC_INSTITUTION", "MILITARY_CIVILIAN"].includes(row.opportunityType)) return "政府/事业单位";
  if (row.opportunityType === "BANK_CAMPUS") return "银行与金融";
  return "企业";
}

function sourceType(row: NormalizedExcelImportRow) {
  return ["NATIONAL_CIVIL_SERVICE", "PROVINCIAL_CIVIL_SERVICE", "SELECTED_GRADUATE", "PUBLIC_INSTITUTION", "MILITARY_CIVILIAN"].includes(row.opportunityType) ? "政府官网" : "招聘官网";
}

function sourceDomain(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function rawContent(row: NormalizedExcelImportRow) {
  return [
    `企业：${row.companyName}`,
    `企业类型：${row.companyType || "待确认"}`,
    `招聘项目：${row.projectName}`,
    `招聘类型：${row.recruitmentType || "待确认"}`,
    `招聘对象：${row.recruitmentAudience || "待确认"}`,
    `招聘批次：${row.recruitmentBatch}`,
    `毕业年份：${row.graduationYear ?? "待确认"}`,
    `学历要求：${row.degreeRequirements.join("、") || "待确认"}`,
    `专业原文：${row.originalMajorText}`,
    `招聘地区：${row.workLocations.join("、") || "待确认"}`,
    `公告时间：${row.publishedAt ?? "待确认"}`,
    `开始时间：${row.startAt ?? "待确认"}`,
    `截止时间：${row.deadline ?? "待确认"}`,
    `官方公告：${row.announcementUrl ?? "未填写"}`,
    `官方报名：${row.applicationUrl ?? "未填写"}`,
    row.adminNote ? `管理员备注：${row.adminNote}` : "",
  ].filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const body = await request.json() as ImportRequest;
    const fileName = body.fileName?.trim() ?? "";
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!fileName || !/\.(xlsx|csv)$/i.test(fileName)) return NextResponse.json({ ok: false, error: "仅支持.xlsx或.csv文件；旧版.xls请先另存为.xlsx" }, { status: 400 });
    if (!rows.length) return NextResponse.json({ ok: false, error: "文件中没有可导入的数据" }, { status: 400 });
    if (rows.length > 5000) return NextResponse.json({ ok: false, error: "单次最多导入5000行" }, { status: 400 });

    const sql = neon(getDatabaseUrl());
    const batchId = crypto.randomUUID();
    await sql`
      INSERT INTO import_batches (id, file_name, uploaded_by, status, field_mapping, total_rows)
      VALUES (${batchId}, ${fileName}, ${adminId}, 'validating', ${json({ headers: body.headers ?? [] })}::jsonb, ${rows.length})
    `;

    let inserted = 0;
    let duplicates = 0;
    let errors = 0;
    let warningRows = 0;
    const rowResults: Array<{ rowNumber: number; status: "pending_review" | "duplicate" | "error"; messages: string[] }> = [];
    const batchKeys = new Set<string>();

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const rawRow = rows[index];
      const normalized = normalizeExcelImportRow(rawRow);
      const importRowId = crypto.randomUUID();
      if (normalized.errors.length) {
        errors += 1;
        rowResults.push({ rowNumber, status: "error", messages: normalized.errors });
        await sql`
          INSERT INTO import_rows (id, batch_id, row_number, raw_data, normalized_data, validation_errors, company_match_status, major_match_status, duplicate_status, review_status)
          VALUES (${importRowId}, ${batchId}, ${rowNumber}, ${json(rawRow)}::jsonb, ${json(normalized)}::jsonb, ${json(normalized.errors)}::jsonb,
            ${normalized.companyName ? "pending" : "unmatched"}, ${normalized.originalMajorText ? "pending" : "unmatched"}, 'pending', 'rejected')
        `;
        continue;
      }

      try {
        const organizationRows = await sql`
          INSERT INTO organizations (id, name, organization_type, status, monitoring_enabled, monitoring_source)
          VALUES (${crypto.randomUUID()}, ${normalized.companyName}, ${organizationType(normalized)}, 'active', false, 'excel_import')
          ON CONFLICT (name) DO UPDATE SET updated_at = now()
          RETURNING id::text AS id
        `;
        const organizationId = String(organizationRows[0].id);
        const dedupeKey = excelImportDedupeKey(normalized, organizationId);
        const batchDuplicate = batchKeys.has(dedupeKey);
        const existing = batchDuplicate ? [{ id: "batch" }] : await sql`
          SELECT id::text AS id FROM staging_opportunities WHERE dedupe_key = ${dedupeKey}
          UNION ALL
          SELECT id::text AS id FROM opportunities
          WHERE organization_id = ${organizationId}
            AND lower(regexp_replace(title, '\\s+', '', 'g')) = lower(regexp_replace(${normalized.projectName}, '\\s+', '', 'g'))
            AND COALESCE(recruitment_year, 0) = COALESCE(${normalized.graduationYear}, 0)
            AND lower(regexp_replace(COALESCE(batch_name, ''), '\\s+', '', 'g')) = lower(regexp_replace(${normalized.recruitmentBatch}, '\\s+', '', 'g'))
          LIMIT 1
        `;
        if (existing.length) {
          duplicates += 1;
          rowResults.push({ rowNumber, status: "duplicate", messages: [batchDuplicate ? "与本次文件中的其他记录重复" : "与已有招聘项目重复"] });
          await sql`
            INSERT INTO import_rows (id, batch_id, row_number, raw_data, normalized_data, validation_errors, company_match_status, major_match_status, duplicate_status, review_status)
            VALUES (${importRowId}, ${batchId}, ${rowNumber}, ${json(rawRow)}::jsonb, ${json(normalized)}::jsonb, '[]'::jsonb, 'matched', 'pending', 'confirmed', 'snoozed')
          `;
          continue;
        }
        batchKeys.add(dedupeKey);

        const sourceUrl = normalized.sourceUrl as string;
        const existingSources = await sql`
          SELECT id::text AS id FROM data_sources
          WHERE organization_id = ${organizationId}
            AND (source_url = ${sourceUrl} OR (source_url IS NULL AND name = ${normalized.sourceName}))
          ORDER BY created_at ASC
          LIMIT 1
        `;
        let dataSourceId = existingSources[0]?.id ? String(existingSources[0].id) : "";
        if (!dataSourceId) {
          dataSourceId = crypto.randomUUID();
          await sql`
            INSERT INTO data_sources (
              id, name, organization_id, level, source_category, source_type, collection_method,
              source_url, source_domain, crawler_strategy, discovery_status, automation_allowed,
              requires_manual_review, status, recruitment_link_status, official_url_status, admin_note
            ) VALUES (
              ${dataSourceId}, ${normalized.sourceName}, ${organizationId}, ${normalized.sourceLevel}, ${sourceCategory(normalized)}, ${sourceType(normalized)}, 'Excel附件',
              ${sourceUrl}, ${sourceDomain(sourceUrl)}, 'MANUAL_EXCEL_IMPORT', 'NEEDS_REVIEW', false,
              true, 'active', 'NEEDS_REVIEW', 'UNREGISTERED', ${`由管理员通过 ${fileName} 导入，必须人工核验来源和招聘字段后才能发布。`}
            )
          `;
        }

        const rawId = crypto.randomUUID();
        const stagingId = crypto.randomUUID();
        const taskId = crypto.randomUUID();
        const originalContent = rawContent(normalized);
        const contentHash = await hash(json({ normalized, rawRow }));
        const parseStatus = normalized.warnings.length ? "partial" : "success";
        if (normalized.warnings.length) warningRows += 1;

        await sql`
          INSERT INTO raw_source_items (
            id, data_source_id, source_url, original_title, original_content, attachment_urls,
            published_at, content_hash, content_summary, parser_name, parser_result,
            normalized_payload, parse_status, review_status, duplicate_status
          ) VALUES (
            ${rawId}, ${dataSourceId}, ${sourceUrl}, ${normalized.projectName}, ${originalContent}, '[]'::jsonb,
            ${normalized.publishedAt}, ${contentHash}, ${`${normalized.companyName} · ${normalized.projectName} · ${normalized.recruitmentBatch}`},
            'excel-import-v1', ${json({ source: "excel_import", batchId, rowNumber, fileName, warnings: normalized.warnings })}::jsonb,
            ${json(normalized)}::jsonb, ${parseStatus}, 'pending', 'unique'
          )
        `;
        await sql`
          INSERT INTO staging_opportunities (
            id, raw_source_item_id, data_source_id, import_batch_id, organization_id,
            company_name, project_name, opportunity_type, recruitment_season, recruitment_year,
            recruitment_batch, graduation_years, degree_requirements, original_major_text,
            normalized_major_names, major_categories, work_locations, published_at, start_at,
            deadline, announcement_url, application_url, deadline_type, relevance_status,
            validation_errors, dedupe_key, review_status, reviewer_note
          ) VALUES (
            ${stagingId}, ${rawId}, ${dataSourceId}, ${batchId}, ${organizationId},
            ${normalized.companyName}, ${normalized.projectName}, ${normalized.opportunityType}, ${normalized.recruitmentSeason}, ${normalized.graduationYear},
            ${normalized.recruitmentBatch}, ${json(normalized.graduationYear ? [normalized.graduationYear] : [])}::jsonb,
            ${json(normalized.degreeRequirements)}::jsonb, ${normalized.originalMajorText}, ${json(normalized.normalizedMajorNames)}::jsonb,
            ${json(normalized.majorCategories)}::jsonb, ${json(normalized.workLocations)}::jsonb, ${normalized.publishedAt}, ${normalized.startAt},
            ${normalized.deadline}, ${normalized.announcementUrl}, ${normalized.applicationUrl}, ${normalized.deadline ? "FIXED_DATE" : "NOT_ANNOUNCED"}, 'CURRENT_OPEN',
            ${json(normalized.warnings)}::jsonb, ${dedupeKey}, 'PENDING', ${`来自Excel导入批次 ${fileName}，等待管理员人工核验。${normalized.timeVerificationStatus}`}
          )
        `;
        await sql`
          INSERT INTO import_rows (id, batch_id, row_number, raw_data, normalized_data, validation_errors, company_match_status, major_match_status, duplicate_status, review_status)
          VALUES (${importRowId}, ${batchId}, ${rowNumber}, ${json(rawRow)}::jsonb, ${json(normalized)}::jsonb, ${json(normalized.warnings)}::jsonb,
            'matched', ${normalized.normalizedMajorNames.length || normalized.majorCategories.length ? "matched" : "needs_review"}, 'unique', 'pending')
        `;
        await sql`
          INSERT INTO admin_tasks (id, task_type, status, priority, raw_source_item_id, import_row_id, due_at, admin_note)
          VALUES (${taskId}, 'new_recruitment', 'open', 'medium', ${rawId}, ${importRowId}, now() + interval '1 day', 'Excel导入的新招聘记录，需核对企业、时间、专业、地区和官方链接。')
        `;
        inserted += 1;
        rowResults.push({ rowNumber, status: "pending_review", messages: normalized.warnings });
      } catch (error) {
        errors += 1;
        const message = error instanceof Error ? error.message : "数据库写入失败";
        rowResults.push({ rowNumber, status: "error", messages: [message] });
        await sql`
          INSERT INTO import_rows (id, batch_id, row_number, raw_data, normalized_data, validation_errors, company_match_status, major_match_status, duplicate_status, review_status)
          VALUES (${importRowId}, ${batchId}, ${rowNumber}, ${json(rawRow)}::jsonb, ${json(normalized)}::jsonb, ${json([message])}::jsonb, 'error', 'error', 'pending', 'rejected')
          ON CONFLICT (batch_id, row_number) DO UPDATE SET validation_errors = EXCLUDED.validation_errors, review_status = 'rejected', updated_at = now()
        `;
      }
    }

    await sql`
      UPDATE import_batches SET status = 'ready_for_review', valid_rows = ${inserted}, error_rows = ${errors}, duplicate_rows = ${duplicates}, completed_at = now(), updated_at = now()
      WHERE id = ${batchId}
    `;
    const pendingRows = await sql`SELECT count(*)::int AS count FROM raw_source_items WHERE review_status IN ('pending', 'in_review')`;
    return NextResponse.json({
      ok: true,
      success: true,
      batchId,
      import_batch_id: batchId,
      summary: { total: rows.length, inserted, duplicates, errors, warningRows, pendingReviewAfter: Number(pendingRows[0]?.count ?? 0) },
      total: rows.length,
      success_count: inserted,
      failed_count: errors,
      duplicate_count: duplicates,
      pending_count: inserted,
      rowResults: rowResults.filter((row) => row.status !== "pending_review" || row.messages.length).slice(0, 50),
      safety: { publishedOpportunitiesChanged: false, requiresManualReview: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Excel导入失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
