import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "../../db";
import { SafeSourceHttpClient, SourceRequestError } from "./http-client";
import { contentHash } from "./hash";
import type { SourceAuditRecord } from "./types";
import { syncFavoriteOpportunityReminders } from "../reminders/store";

type SqlClient = ReturnType<typeof neon<false, false>>;

export const INITIAL_SYNC_STATUSES = [
  "CURRENT_RECRUITMENT",
  "OFFICIAL_SOURCE_FOUND",
  "NO_CURRENT_RECRUITMENT",
  "UPCOMING",
  "ACCESS_FAILED",
  "SOURCE_NOT_FOUND",
  "NEEDS_REVIEW",
  "NOT_CHECKED",
] as const;

type InitialSyncStatus = typeof INITIAL_SYNC_STATUSES[number];
export type InitialSyncScope = "monitoring" | "target_100";
const TARGET_AUDIT_MARKER = "%target-100-audit:v1%";
type OrganizationRow = {
  id: string;
  name: string;
  monitoring_category: string | null;
  monitoring_region_name: string | null;
  monitoring_source: string | null;
  priority: string;
  official_website: string | null;
  recruitment_website: string | null;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  list_page_url: string | null;
  source_domain: string | null;
  source_level: string | null;
  discovery_status: string | null;
  requires_login: boolean | null;
  has_captcha: boolean | null;
  requires_javascript: boolean | null;
  request_interval_seconds: number | null;
  user_agent: string | null;
};

type ScanResult = {
  organizationId: string;
  organizationName: string;
  category: string;
  region: string;
  status: InitialSyncStatus;
  officialUrl: string | null;
  failureType: string | null;
  retryCount: number;
  discovered: number;
  rawInserted: number;
  stagingInserted: number;
  formalAdded: number;
  duplicate: number;
  updated: number;
  note: string;
};

function json(value: unknown) {
  return JSON.stringify(value);
}

function normalize(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function stableUuid(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const chars = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

function decodeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html: string, fallback: string) {
  return normalize(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || fallback;
}

function hostnameFromUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function sourceUrl(row: OrganizationRow) {
  return row.list_page_url || row.source_url || row.recruitment_website || row.official_website;
}

function classifyPage(text: string, month: number): { status: InitialSyncStatus; title: string; season: string; year: number | null; reason: string } {
  const recruitmentSignal = /招聘|校招|校园|应届|毕业生|人才|管培|campus|graduate|recruit/i.test(text);
  const year = text.match(/20(2[5-9])/);
  const recruitmentYear = year ? Number(year[0]) : null;
  const has2027 = /2027|27届|2027届/.test(text);
  const autumn = /秋招|秋季校园|秋季招聘/.test(text);
  const spring = /春招|春季校园|春季招聘/.test(text);
  const upcoming = has2027 && recruitmentSignal && /即将|敬请期待|即将启动|即将开放|即将发布/.test(text);
  const current = has2027 && recruitmentSignal && /校园|校招|应届|毕业生|管培|秋招|春招|campus|graduate/i.test(text);
  const status: InitialSyncStatus = upcoming ? "UPCOMING" : current ? "CURRENT_RECRUITMENT" : recruitmentSignal ? "NO_CURRENT_RECRUITMENT" : "OFFICIAL_SOURCE_FOUND";
  const season = autumn ? "AUTUMN" : spring ? "SPRING" : month >= 7 && month <= 12 ? "AUTUMN" : month >= 2 && month <= 5 ? "SPRING" : "OTHER";
  return { status, title: "", season, year: recruitmentYear, reason: upcoming ? "官方页面明确预告2027招聘" : current ? "官方页面出现当前应届/校园招聘项目" : recruitmentSignal ? "官方招聘入口可访问，但未确认当前2027项目" : "官方来源页面可访问" };
}

function isConcreteRecruitmentPage(title: string, text: string, url: string) {
  const genericTitle = /招聘官网|招聘网站|校园招聘|人才招聘|招聘入口|官方招聘|首页|主页/i.test(title);
  const detailPath = (() => {
    try {
      const parsed = new URL(url);
      return parsed.pathname.length > 8 || Boolean(parsed.search || parsed.hash);
    } catch {
      return false;
    }
  })();
  const concreteSignal = /招聘公告|招聘简章|招聘启事|报名|投递|岗位|职位|申请|管培生|应届生招聘/i.test(text);
  return !genericTitle && detailPath && /2027|27届|应届|毕业生|校园招聘|校招/i.test(text) && concreteSignal;
}

function opportunityType(category: string | null) {
  const value = normalize(category);
  if (/银行|金融/.test(value)) return "BANK_CAMPUS";
  if (/央企|中央/.test(value)) return "CENTRAL_SOE";
  if (/国企|地方/.test(value)) return "LOCAL_SOE";
  return "ENTERPRISE_CAMPUS";
}

function failureType(error: unknown) {
  if (error instanceof SourceRequestError) {
    if (error.code === "HTTP_403") return "403";
    if (error.code === "HTTP_429") return "429";
    if (error.code === "TIMEOUT") return "TIMEOUT";
    if (error.code === "REDIRECT_BLOCKED") return "REDIRECT_LOOP";
    if (error.code === "SSRF_BLOCKED") return "SECURITY_BLOCK";
    if (error.status === 502) return "502";
    if (error.code === "INVALID_URL") return "INVALID_URL";
    return error.code;
  }
  return "TOOL_ERROR";
}

function nextCheck(status: InitialSyncStatus, now: Date) {
  const next = new Date(now);
  next.setDate(next.getDate() + (status === "CURRENT_RECRUITMENT" || status === "UPCOMING" || status === "ACCESS_FAILED" ? 1 : 7));
  return next;
}

async function ensureInitialSyncColumns(sql: SqlClient) {
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS initial_sync_status text NOT NULL DEFAULT 'NOT_CHECKED',
      ADD COLUMN IF NOT EXISTS initial_sync_last_checked_at timestamptz,
      ADD COLUMN IF NOT EXISTS initial_sync_next_check_at timestamptz,
      ADD COLUMN IF NOT EXISTS initial_sync_official_url text,
      ADD COLUMN IF NOT EXISTS initial_sync_recruitment_url text,
      ADD COLUMN IF NOT EXISTS initial_sync_failure_type text,
      ADD COLUMN IF NOT EXISTS initial_sync_retry_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS initial_sync_last_result jsonb,
      ADD COLUMN IF NOT EXISTS initial_sync_batch text,
      ADD COLUMN IF NOT EXISTS initial_sync_completed_at timestamptz
  `;
  await sql`CREATE INDEX IF NOT EXISTS organizations_initial_sync_status_idx ON organizations (monitoring_enabled, initial_sync_status, priority)`;
  await sql`
    CREATE TABLE IF NOT EXISTS organization_initial_sync_checks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      batch_name text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
      status text NOT NULL, official_url text, recruitment_url text, failure_type text,
      retry_count integer NOT NULL DEFAULT 0, discovered_count integer NOT NULL DEFAULT 0,
      formal_added integer NOT NULL DEFAULT 0, error_message text, details jsonb,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS organization_initial_sync_checks_org_idx ON organization_initial_sync_checks (organization_id, finished_at)`;
  await sql`CREATE INDEX IF NOT EXISTS organization_initial_sync_checks_status_idx ON organization_initial_sync_checks (status)`;
}

async function absorbBatch1State(sql: SqlClient) {
  await sql`
    WITH latest AS (
      SELECT DISTINCT ON (ds.organization_id)
        ds.organization_id,
        ds.source_url,
        cr.finished_at,
        cr.status AS run_status,
        ds.last_error,
        EXISTS (
          SELECT 1 FROM opportunities o
          WHERE o.organization_id = ds.organization_id AND o.publication_status = 'published' AND o.recruitment_year = 2027
        ) AS has_current
      FROM data_sources ds
      JOIN collection_runs cr ON cr.data_source_id = ds.id
      WHERE cr.trigger_type = 'initial_sync_batch_1'
      ORDER BY ds.organization_id, cr.finished_at DESC NULLS LAST
    )
    UPDATE organizations o SET
      initial_sync_status = CASE WHEN latest.has_current THEN 'CURRENT_RECRUITMENT' WHEN latest.run_status = 'success' THEN 'NO_CURRENT_RECRUITMENT' ELSE 'ACCESS_FAILED' END,
      initial_sync_last_checked_at = latest.finished_at,
      initial_sync_next_check_at = COALESCE(latest.finished_at, now()) + CASE WHEN latest.run_status = 'success' THEN interval '7 days' ELSE interval '1 day' END,
      initial_sync_official_url = latest.source_url,
      initial_sync_failure_type = CASE WHEN latest.run_status = 'success' THEN NULL ELSE COALESCE(latest.last_error, 'BATCH_1_FAILURE') END,
      initial_sync_last_result = jsonb_build_object('source', 'BATCH_1', 'legacyRunStatus', latest.run_status),
      initial_sync_batch = 'BATCH_1',
      initial_sync_completed_at = latest.finished_at,
      updated_at = now()
    FROM latest
    WHERE o.id = latest.organization_id AND o.monitoring_enabled = true AND o.initial_sync_status = 'NOT_CHECKED'
  `;
}

export async function getInitialSyncProgress(sqlInput?: SqlClient, scope: InitialSyncScope = "monitoring") {
  const sql = sqlInput ?? neon(getDatabaseUrl());
  await ensureInitialSyncColumns(sql);
  if (scope === "monitoring") await absorbBatch1State(sql);
  const rows = scope === "target_100" ? await sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE o.initial_sync_status = 'CURRENT_RECRUITMENT')::int AS current_recruitment,
      count(*) FILTER (WHERE o.initial_sync_status = 'OFFICIAL_SOURCE_FOUND')::int AS official_source_found,
      count(*) FILTER (WHERE o.initial_sync_status = 'NO_CURRENT_RECRUITMENT')::int AS no_current_recruitment,
      count(*) FILTER (WHERE o.initial_sync_status = 'UPCOMING')::int AS upcoming,
      count(*) FILTER (WHERE o.initial_sync_status = 'ACCESS_FAILED')::int AS access_failed,
      count(*) FILTER (WHERE o.initial_sync_status = 'SOURCE_NOT_FOUND')::int AS source_not_found,
      count(*) FILTER (WHERE o.initial_sync_status = 'NEEDS_REVIEW')::int AS needs_review,
      count(*) FILTER (WHERE o.initial_sync_status = 'NOT_CHECKED')::int AS not_checked
    FROM organizations o
    WHERE EXISTS (SELECT 1 FROM data_sources target_ds WHERE target_ds.organization_id = o.id AND target_ds.admin_note LIKE ${TARGET_AUDIT_MARKER})
  ` : await sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE initial_sync_status = 'CURRENT_RECRUITMENT')::int AS current_recruitment,
      count(*) FILTER (WHERE initial_sync_status = 'OFFICIAL_SOURCE_FOUND')::int AS official_source_found,
      count(*) FILTER (WHERE initial_sync_status = 'NO_CURRENT_RECRUITMENT')::int AS no_current_recruitment,
      count(*) FILTER (WHERE initial_sync_status = 'UPCOMING')::int AS upcoming,
      count(*) FILTER (WHERE initial_sync_status = 'ACCESS_FAILED')::int AS access_failed,
      count(*) FILTER (WHERE initial_sync_status = 'SOURCE_NOT_FOUND')::int AS source_not_found,
      count(*) FILTER (WHERE initial_sync_status = 'NEEDS_REVIEW')::int AS needs_review,
      count(*) FILTER (WHERE initial_sync_status = 'NOT_CHECKED')::int AS not_checked
    FROM organizations WHERE monitoring_enabled = true
  `;
  const categoryRows = scope === "target_100"
    ? await sql`SELECT COALESCE(o.organization_type, '未分类') AS category, o.initial_sync_status AS status, count(*)::int AS count FROM organizations o WHERE EXISTS (SELECT 1 FROM data_sources target_ds WHERE target_ds.organization_id = o.id AND target_ds.admin_note LIKE ${TARGET_AUDIT_MARKER}) GROUP BY 1, 2 ORDER BY 1, 2`
    : await sql`SELECT COALESCE(monitoring_category, '未分类') AS category, initial_sync_status AS status, count(*)::int AS count FROM organizations WHERE monitoring_enabled = true GROUP BY 1, 2 ORDER BY 1, 2`;
  const regionRows = scope === "target_100"
    ? await sql`SELECT '全国' AS region, o.initial_sync_status AS status, count(*)::int AS count FROM organizations o WHERE EXISTS (SELECT 1 FROM data_sources target_ds WHERE target_ds.organization_id = o.id AND target_ds.admin_note LIKE ${TARGET_AUDIT_MARKER}) GROUP BY 1, 2 ORDER BY 1, 2`
    : await sql`SELECT COALESCE(monitoring_region_name, '全国') AS region, initial_sync_status AS status, count(*)::int AS count FROM organizations WHERE monitoring_enabled = true GROUP BY 1, 2 ORDER BY 1, 2`;
  const row = rows[0] as Record<string, number>;
  return {
    total: Number(row?.total ?? 0),
    completed: Number(row?.total ?? 0) - Number(row?.not_checked ?? 0),
    currentRecruitment: Number(row?.current_recruitment ?? 0),
    officialSourceFound: Number(row?.official_source_found ?? 0),
    noCurrentRecruitment: Number(row?.no_current_recruitment ?? 0),
    upcoming: Number(row?.upcoming ?? 0),
    accessFailed: Number(row?.access_failed ?? 0),
    sourceNotFound: Number(row?.source_not_found ?? 0),
    needsReview: Number(row?.needs_review ?? 0),
    notChecked: Number(row?.not_checked ?? 0),
    scope,
    byCategory: categoryRows,
    byRegion: regionRows,
  };
}

async function nextOrganizations(sql: SqlClient, batchSize: number, scope: InitialSyncScope) {
  const rows = scope === "target_100" ? await sql`
    SELECT o.id::text AS id, o.name, o.monitoring_category, o.monitoring_region_name, o.monitoring_source,
      o.priority, o.official_website, o.recruitment_website,
      ds.id::text AS source_id, ds.name AS source_name, ds.source_url, ds.list_page_url, ds.source_domain,
      ds.level AS source_level, ds.discovery_status, ds.requires_login, ds.has_captcha,
      ds.requires_javascript, ds.request_interval_seconds, ds.user_agent
    FROM organizations o
    LEFT JOIN LATERAL (
      SELECT d.* FROM data_sources d
      WHERE d.organization_id = o.id AND d.status = 'active'
        AND d.level <> 'D级' AND d.admin_note LIKE ${TARGET_AUDIT_MARKER}
        AND (d.list_page_url IS NOT NULL OR d.source_url IS NOT NULL)
      ORDER BY CASE WHEN d.discovery_status = 'VERIFIED' THEN 0 ELSE 1 END,
        d.source_last_verified_at DESC NULLS LAST, d.updated_at DESC
      LIMIT 1
    ) ds ON true
    WHERE EXISTS (SELECT 1 FROM data_sources target_ds WHERE target_ds.organization_id = o.id AND target_ds.admin_note LIKE ${TARGET_AUDIT_MARKER})
      AND o.initial_sync_status = 'NOT_CHECKED'
    ORDER BY CASE o.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, o.name
    LIMIT ${batchSize}
  ` : await sql`
    SELECT o.id::text AS id, o.name, o.monitoring_category, o.monitoring_region_name, o.monitoring_source,
      o.priority, o.official_website, o.recruitment_website,
      ds.id::text AS source_id, ds.name AS source_name, ds.source_url, ds.list_page_url, ds.source_domain,
      ds.level AS source_level, ds.discovery_status, ds.requires_login, ds.has_captcha,
      ds.requires_javascript, ds.request_interval_seconds, ds.user_agent
    FROM organizations o
    LEFT JOIN LATERAL (
      SELECT d.* FROM data_sources d
      WHERE d.organization_id = o.id AND d.status = 'active'
        AND d.level <> 'D级'
        AND (d.list_page_url IS NOT NULL OR d.source_url IS NOT NULL)
      ORDER BY CASE WHEN d.discovery_status = 'VERIFIED' THEN 0 ELSE 1 END,
        d.source_last_verified_at DESC NULLS LAST, d.updated_at DESC
      LIMIT 1
    ) ds ON true
    WHERE o.monitoring_enabled = true AND o.initial_sync_status = 'NOT_CHECKED'
    ORDER BY CASE o.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
      COALESCE(o.monitoring_category, ''), COALESCE(o.monitoring_region_name, ''), o.name
    LIMIT ${batchSize}
  `;
  return rows as OrganizationRow[];
}

async function insertCheck(sql: SqlClient, row: OrganizationRow, batchName: string, result: ScanResult, now: Date, details: Record<string, unknown>) {
  await sql`
    INSERT INTO organization_initial_sync_checks (
      id, organization_id, batch_name, started_at, finished_at, status,
      official_url, recruitment_url, failure_type, retry_count,
      discovered_count, formal_added, error_message, details
    ) VALUES (
      ${await stableUuid(`initial-sync-check:${batchName}:${row.id}:${now.toISOString()}`)}, ${row.id}, ${batchName}, ${now}, now(), ${result.status},
      ${result.officialUrl}, ${result.officialUrl}, ${result.failureType}, ${result.retryCount},
      ${result.discovered}, ${result.formalAdded}, ${result.note}, ${json(details)}::jsonb
    )
  `;
}

async function updateOrganization(sql: SqlClient, row: OrganizationRow, batchName: string, result: ScanResult, now: Date, details: Record<string, unknown>) {
  const next = nextCheck(result.status, now);
  await sql`
    UPDATE organizations SET
      initial_sync_status = ${result.status}, initial_sync_last_checked_at = ${now}, initial_sync_next_check_at = ${next},
      initial_sync_official_url = ${result.officialUrl}, initial_sync_recruitment_url = ${result.officialUrl},
      initial_sync_failure_type = ${result.failureType}, initial_sync_retry_count = ${result.retryCount},
      initial_sync_last_result = ${json(details)}::jsonb, initial_sync_batch = ${batchName},
      initial_sync_completed_at = ${now}, updated_at = now()
    WHERE id = ${row.id}
  `;
  await insertCheck(sql, row, batchName, result, now, details);
}

async function createReviewTask(sql: SqlClient, rawId: string, taskType: "new_recruitment" | "page_changed", note: string) {
  await sql`
    INSERT INTO admin_tasks (id, task_type, status, priority, raw_source_item_id, due_at, admin_note)
    VALUES (gen_random_uuid(), ${taskType}, 'open', 'high', ${rawId}, now() + interval '1 day', ${note})
  `;
}

async function persistCandidate(sql: SqlClient, row: OrganizationRow, sourceUrlValue: string, html: string, text: string, pageTitle: string, classification: ReturnType<typeof classifyPage>, adminId: string, now: Date) {
  const hash = await contentHash(html || text);
  const rawId = await stableUuid(`initial-sync:raw:${row.id}:${sourceUrlValue}:${hash}`);
  const stagingId = await stableUuid(`initial-sync:staging:${row.id}:${sourceUrlValue}:${hash}`);
  const opportunityId = await stableUuid(`initial-sync:opportunity:${row.id}:${sourceUrlValue}:${pageTitle}`);
  const sourceLevel = row.source_level || "B级";
  const sourceId = row.source_id;
  const existingRaw = await sql`SELECT id::text AS id FROM raw_source_items WHERE source_url = ${sourceUrlValue} AND content_hash = ${hash} LIMIT 1`;
  if (existingRaw[0]?.id) return { rawInserted: 0, stagingInserted: 0, formalAdded: 0, duplicate: 0, updated: 0, unchanged: true, status: "unchanged" };
  const existingFormal = await sql`
    SELECT id::text AS id FROM opportunities
    WHERE organization_id = ${row.id} AND recruitment_year = ${classification.year ?? 2027}
      AND (official_announcement_url = ${sourceUrlValue} OR official_application_url = ${sourceUrlValue})
    LIMIT 1
  `;
  const duplicate = Boolean(existingFormal[0]?.id);
  const autoPublish = !duplicate && Boolean(sourceId) && sourceLevel === "A级" && classification.status === "CURRENT_RECRUITMENT" && isConcreteRecruitmentPage(pageTitle, text, sourceUrlValue);
  const opportunityTypeValue = opportunityType(row.monitoring_category);
  const title = pageTitle || `${row.name}官方招聘页面`;
  const batch = classification.season === "AUTUMN" ? "秋招" : classification.season === "SPRING" ? "春招" : "公开招聘";
  await sql`
    INSERT INTO raw_source_items (
      id, data_source_id, source_url, original_title, original_content, original_html,
      attachment_urls, published_at, collected_at, content_hash, content_summary,
      parser_name, parser_result, normalized_payload, parse_status, review_status, duplicate_status
    ) VALUES (
      ${rawId}, ${sourceId}, ${sourceUrlValue}, ${title}, ${text.slice(0, 80000)}, ${html.slice(0, 180000)},
      '[]'::jsonb, NULL, ${now}, ${hash}, ${text.slice(0, 1000)}, 'initial-sync-public-html-v1',
      ${json({ classification: classification.status, sourceUrl: sourceUrlValue })}::jsonb,
      ${json({ organization: row.name, title, year: classification.year ?? 2027, season: classification.season, sourceUrl: sourceUrlValue })}::jsonb,
      'success', ${autoPublish ? "converted" : "pending"}, ${duplicate ? "suspected" : "unique"}
    )
  `;
  await sql`
    INSERT INTO staging_opportunities (
      id, raw_source_item_id, data_source_id, organization_id, company_name, project_name,
      opportunity_type, recruitment_season, recruitment_year, recruitment_batch,
      graduation_years, degree_requirements, original_major_text, normalized_major_names,
      major_categories, work_locations, published_at, deadline, announcement_url, application_url,
      deadline_type, relevance_status, validation_errors, dedupe_key, review_status, reviewer_note,
      reviewed_by, reviewed_at
    ) VALUES (
      ${stagingId}, ${rawId}, ${sourceId}, ${row.id}, ${row.name}, ${title}, ${opportunityTypeValue},
      ${classification.season}, ${classification.year ?? 2027}, ${batch}, '[2027]'::jsonb, '[]'::jsonb,
      '以官方岗位详情为准', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL,
      ${sourceUrlValue}, ${sourceUrlValue}, 'NOT_ANNOUNCED', 'CURRENT_OPEN', '[]'::jsonb,
      ${`${row.id}:${title}:${classification.year ?? 2027}:${classification.season}:${sourceUrlValue}`},
      ${autoPublish ? "APPROVED" : "PENDING"}, ${autoPublish ? "A级官方页面自动核验通过。" : "待管理员核对岗位详情、专业和报名入口。"},
      ${autoPublish ? adminId : null}, ${autoPublish ? now : null}
    )
  `;
  if (duplicate) {
    await createReviewTask(sql, rawId, "page_changed", `同一官方入口出现新内容，已保留原正式机会，待比较字段后决定是否更新：${title}`);
    return { rawInserted: 1, stagingInserted: 1, formalAdded: 0, duplicate: 1, updated: 0, unchanged: false, status: "duplicate" };
  }
  if (!autoPublish) {
    await createReviewTask(sql, rawId, "new_recruitment", `发现候选招聘：${title}。请核对专业、学历、地区和官方报名入口。`);
    return { rawInserted: 1, stagingInserted: 1, formalAdded: 0, duplicate: 0, updated: 0, unchanged: false, status: "pending_review" };
  }
  const calculatedStatus = classification.status === "UPCOMING" ? "upcoming" : "recruiting";
  await sql`
    INSERT INTO opportunities (
      id, title, organization_id, opportunity_type, recruitment_season, recruitment_year,
      target_graduation_years, batch_name, description, work_locations, education_requirements,
      degree_requirements, major_requirement_text, official_announcement_url, official_application_url,
      source_id, source_level, verification_status, last_verified_at, verified_by, next_verify_at,
      official_page_status, publication_status, calculated_status, manual_status, deadline_type,
      deadline_at, opportunity_relevance_status, data_credibility, is_demo
    ) VALUES (
      ${opportunityId}, ${title}, ${row.id}, ${opportunityTypeValue}, ${classification.season}, ${classification.year ?? 2027},
      '[2027]'::jsonb, ${batch}, ${text.slice(0, 80000)}, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '以官方岗位详情为准', ${sourceUrlValue}, ${sourceUrlValue}, ${sourceId}, ${sourceLevel}, 'verified',
      ${now}, ${adminId}, ${new Date(now.getTime() + 24 * 60 * 60 * 1000)}, 'accessible', 'published',
      ${calculatedStatus}, ${calculatedStatus}, 'NOT_ANNOUNCED', NULL, 'CURRENT_OPEN', '已核验', false
    ) ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO opportunity_major_rules (id, opportunity_id, rule_type, rule_value, original_text, requires_manual_review)
    VALUES (${await stableUuid(`initial-sync:major-rule:${opportunityId}`)}, ${opportunityId}, 'OTHER', 'OFFICIAL_DETAIL_REQUIRED', '以官方岗位详情为准', true)
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`UPDATE raw_source_items SET promoted_opportunity_id = ${opportunityId}, review_status = 'converted', reviewed_by = ${adminId}, reviewed_at = ${now}, updated_at = now() WHERE id = ${rawId}`;
  await sql`UPDATE staging_opportunities SET promoted_opportunity_id = ${opportunityId}, review_status = 'APPROVED', reviewed_by = ${adminId}, reviewed_at = ${now}, updated_at = now() WHERE id = ${stagingId}`;
  await syncFavoriteOpportunityReminders(opportunityId).catch(() => undefined);
  return { rawInserted: 1, stagingInserted: 1, formalAdded: 1, duplicate: 0, updated: 0, unchanged: false, status: "published" };
}

async function scanOrganization(sql: SqlClient, row: OrganizationRow, batchName: string, adminId: string, month: number, client: SafeSourceHttpClient, now: Date): Promise<ScanResult> {
  const url = sourceUrl(row);
  const base: ScanResult = { organizationId: row.id, organizationName: row.name, category: row.monitoring_category ?? "未分类", region: row.monitoring_region_name ?? "全国", status: "NOT_CHECKED", officialUrl: url, failureType: null, retryCount: 0, discovered: 0, rawInserted: 0, stagingInserted: 0, formalAdded: 0, duplicate: 0, updated: 0, note: "" };
  if (!url) {
    base.status = "SOURCE_NOT_FOUND";
    base.note = "监控池内暂无已确认的官方官网或招聘入口；未使用猜测URL。";
    await updateOrganization(sql, row, batchName, base, now, { reason: "no_confirmed_official_source_in_registry", checkedAgainst: "registered_data_sources_and_organization_profile" });
    return base;
  }
  const sourceDomain = row.source_domain || hostnameFromUrl(url);
  const source: SourceAuditRecord = {
    id: row.source_id ?? await stableUuid(`initial-sync:source:${row.id}:${url}`), organizationId: row.id,
    sourceName: row.source_name ?? `${row.name}官方来源`, sourceDomain, sourceUrl: row.source_url || url,
    listPageUrl: row.list_page_url, detailUrlPattern: null, apiUrl: null, rssUrl: null, robotsUrl: null,
    robotsResult: null, termsUrl: null, termsResult: null, requiresJavascript: row.requires_javascript,
    requiresLogin: row.requires_login, hasCaptcha: row.has_captcha, discoveryStatus: row.discovery_status === "VERIFIED" || !row.source_id ? "VERIFIED" : "NEEDS_REVIEW",
    automationAllowed: false, incrementalSyncEnabled: true, requestIntervalSeconds: row.request_interval_seconds ?? 10,
    maxRequestsPerRun: 1, maxRequestsPerDay: 2, userAgent: row.user_agent, lastVerifiedAt: null,
    legalNotes: null, technicalNotes: null,
  };
  try {
    const fetched = await client.get(source, url);
    const html = new TextDecoder().decode(fetched.body);
    const text = /html/i.test(fetched.contentType ?? "") ? decodeHtml(html) : normalize(html);
    if (!text) {
      base.status = "ACCESS_FAILED"; base.failureType = "EMPTY_BODY"; base.note = "官方来源返回空正文。";
      await updateOrganization(sql, row, batchName, base, now, { url, failureType: base.failureType });
      return base;
    }
    if (text.length < 120 && /javascript|启用脚本|请使用浏览器/i.test(text)) {
      base.status = "ACCESS_FAILED"; base.failureType = "JS_REQUIRED"; base.note = "来源需要公开页面渲染，当前采集器未绕过脚本保护。";
      await updateOrganization(sql, row, batchName, base, now, { url, failureType: base.failureType });
      return base;
    }
    const classification = classifyPage(text, month);
    const pageTitle = titleFromHtml(html, row.source_name ?? `${row.name}官方招聘页面`);
    classification.title = pageTitle;
    base.status = classification.status; base.note = classification.reason;
    if (classification.status === "CURRENT_RECRUITMENT" || classification.status === "UPCOMING") {
      const persisted = await persistCandidate(sql, row, fetched.url, html, text, pageTitle, classification, adminId, now);
      base.discovered = 1; base.rawInserted = persisted.rawInserted; base.stagingInserted = persisted.stagingInserted; base.formalAdded = persisted.formalAdded; base.duplicate = persisted.duplicate; base.updated = persisted.updated;
    }
    await sql`
      UPDATE data_sources SET last_checked_at = ${now}, last_successful_collected_at = ${now}, content_fingerprint = ${await contentHash(html || text)}, last_error = NULL, failure_count = 0, next_check_at = ${nextCheck(base.status, now)}, updated_at = now()
      WHERE id = ${row.source_id}
    `;
    await updateOrganization(sql, row, batchName, base, now, { url: fetched.url, pageTitle, classification, contentLength: text.length });
    return base;
  } catch (error) {
    base.status = "ACCESS_FAILED"; base.failureType = failureType(error); base.retryCount = error instanceof SourceRequestError && error.retryable ? 1 : 0; base.note = error instanceof Error ? error.message : "来源检查失败";
    await sql`
      UPDATE data_sources SET last_checked_at = ${now}, last_error = ${base.note}, failure_count = failure_count + 1, next_check_at = ${nextCheck(base.status, now)}, updated_at = now()
      WHERE id = ${row.source_id}
    `;
    await updateOrganization(sql, row, batchName, base, now, { url, failureType: base.failureType, retryCount: base.retryCount });
    return base;
  }
}

export async function runInitialSyncBatch(options: { databaseUrl?: string; adminId: string; batchSize?: number; batchName?: string; now?: Date; scope?: InitialSyncScope }) {
  const sql = neon(options.databaseUrl ?? getDatabaseUrl());
  const now = options.now ?? new Date();
  const scope = options.scope ?? "monitoring";
  await ensureInitialSyncColumns(sql);
  if (scope === "monitoring") await absorbBatch1State(sql);
  const before = await getInitialSyncProgress(sql, scope);
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 50, 100));
  const batchName = options.batchName ?? (scope === "target_100" ? `TARGET_100_BATCH_${Math.floor(before.completed / batchSize) + 1}` : `BATCH_${Math.floor(before.completed / batchSize) + 2}`);
  const rows = await nextOrganizations(sql, batchSize, scope);
  const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "numeric" }).format(now));
  const client = new SafeSourceHttpClient({ policy: { maxRetries: 1, timeoutMs: 12_000, maxResponseBytes: 2_000_000, retryBackoffMs: 1_000 } });
  const results: ScanResult[] = [];
  for (let offset = 0; offset < rows.length; offset += 4) {
    results.push(...await Promise.all(rows.slice(offset, offset + 4).map((row) => scanOrganization(sql, row, batchName, options.adminId, month, client, now))));
  }
  const after = await getInitialSyncProgress(sql, scope);
  return {
    ok: true, mode: scope === "target_100" ? "TARGET_100_OFFICIAL_AUDIT" : "INITIAL_SYNC", scope, batch: batchName, batchSize, executedAt: now.toISOString(),
    before, after, processed: results.length, results,
    summary: {
      successful: results.filter((item) => item.status !== "ACCESS_FAILED" && item.status !== "NOT_CHECKED").length,
      failed: results.filter((item) => item.status === "ACCESS_FAILED").length,
      currentRecruitment: results.filter((item) => item.status === "CURRENT_RECRUITMENT").length,
      noCurrentRecruitment: results.filter((item) => item.status === "NO_CURRENT_RECRUITMENT").length,
      officialSourceFound: results.filter((item) => item.status === "OFFICIAL_SOURCE_FOUND").length,
      upcoming: results.filter((item) => item.status === "UPCOMING").length,
      sourceNotFound: results.filter((item) => item.status === "SOURCE_NOT_FOUND").length,
      needsReview: results.filter((item) => item.status === "NEEDS_REVIEW").length,
      rawInserted: results.reduce((sum, item) => sum + item.rawInserted, 0),
      stagingInserted: results.reduce((sum, item) => sum + item.stagingInserted, 0),
      formalAdded: results.reduce((sum, item) => sum + item.formalAdded, 0),
      duplicate: results.reduce((sum, item) => sum + item.duplicate, 0),
      updated: results.reduce((sum, item) => sum + item.updated, 0),
    },
    safety: { noLoginBypass: true, noCaptchaBypass: true, noAccessRestrictionBypass: true, noSyntheticData: true },
  };
}

export async function initialSyncExport(sqlInput: SqlClient, kind: "failed" | "no-current" | "current") {
  const sql = sqlInput;
  if (kind === "failed") return sql`SELECT name AS organization_name, monitoring_category AS category, monitoring_region_name AS province, initial_sync_official_url AS official_url, initial_sync_failure_type AS failure_type, initial_sync_last_checked_at AS last_checked_at, initial_sync_retry_count AS retry_count, initial_sync_next_check_at AS next_action FROM organizations WHERE monitoring_enabled = true AND initial_sync_status = 'ACCESS_FAILED' ORDER BY priority, name`;
  if (kind === "no-current") return sql`SELECT name AS organization_name, initial_sync_official_url AS official_recruitment_url, initial_sync_last_checked_at AS last_checked_at, initial_sync_next_check_at AS next_check_at FROM organizations WHERE monitoring_enabled = true AND initial_sync_status IN ('NO_CURRENT_RECRUITMENT', 'OFFICIAL_SOURCE_FOUND') ORDER BY priority, name`;
  return sql`SELECT o.name AS organization, op.title, o.monitoring_category AS category, op.recruitment_season AS season, op.recruitment_year AS graduation_year, NULL AS publication_date, NULL AS application_start, op.deadline_at AS application_deadline, NULL AS region, op.official_announcement_url, op.official_application_url, op.source_level, op.last_verified_at, op.publication_status FROM organizations o JOIN opportunities op ON op.organization_id = o.id WHERE o.monitoring_enabled = true AND o.initial_sync_status IN ('CURRENT_RECRUITMENT', 'UPCOMING') ORDER BY o.priority, o.name, op.created_at DESC`;
}

export async function targetAuditRows(sqlInput: SqlClient) {
  const sql = sqlInput;
  return sql`
    SELECT
      o.name AS organization_name,
      o.organization_type,
      o.priority,
      o.official_website,
      ds.id::text AS source_id,
      COALESCE(o.initial_sync_official_url, ds.source_url, ds.list_page_url) AS candidate_official_url,
      COALESCE(o.initial_sync_official_url, ds.source_url, ds.list_page_url) AS official_recruitment_url,
      ds.source_url AS registered_official_url,
      COALESCE(ds.official_url_status, 'UNREGISTERED') AS official_url_status,
      (ds.official_url_status = 'PUBLISHED') AS official_confirmed,
      (COALESCE(ds.admin_note, '') LIKE '%[manual-review-requested:%') AS manual_review_requested,
      (COALESCE(ds.admin_note, '') LIKE '%[manual-review-confirmed:%') AS manual_review_confirmed,
      o.initial_sync_status AS current_recruitment_status,
      current_op.title AS current_recruitment_title,
      current_op.official_announcement_url AS current_recruitment_url,
      current_op.official_application_url AS application_url,
      o.initial_sync_last_checked_at AS last_checked_at,
      CASE
        WHEN o.initial_sync_status = 'ACCESS_FAILED' THEN 'ACCESS_FAILED'
        WHEN o.initial_sync_status = 'SOURCE_NOT_FOUND' THEN 'SOURCE_NOT_FOUND'
        WHEN o.initial_sync_status = 'NOT_CHECKED' THEN 'NOT_CHECKED'
        WHEN ds.discovery_status = 'VERIFIED' THEN 'VERIFIED'
        ELSE 'NEEDS_REVIEW'
      END AS source_status,
      o.initial_sync_failure_type AS failure_type,
      (SELECT count(*)::int FROM opportunities published_op WHERE published_op.organization_id = o.id AND published_op.publication_status = 'published') AS published_opportunity_count,
      COALESCE(o.initial_sync_last_result->>'reason', '') AS notes
    FROM organizations o
    LEFT JOIN LATERAL (
      SELECT d.* FROM data_sources d
      WHERE d.organization_id = o.id AND d.status = 'active' AND d.admin_note LIKE ${TARGET_AUDIT_MARKER}
      ORDER BY CASE WHEN d.source_url IS NOT NULL THEN 0 ELSE 1 END, d.updated_at DESC
      LIMIT 1
    ) ds ON true
    LEFT JOIN LATERAL (
      SELECT op.title, op.official_announcement_url, op.official_application_url
      FROM opportunities op
      WHERE op.organization_id = o.id AND op.publication_status = 'published'
      ORDER BY op.created_at DESC
      LIMIT 1
    ) current_op ON true
    WHERE EXISTS (SELECT 1 FROM data_sources target_ds WHERE target_ds.organization_id = o.id AND target_ds.admin_note LIKE ${TARGET_AUDIT_MARKER})
    ORDER BY CASE o.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, o.name
  `;
}
