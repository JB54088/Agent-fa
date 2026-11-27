import { neon } from "@neondatabase/serverless";
import { detectDeadlineType } from "./normalize.ts";
import { SafeSourceHttpClient, SourceRequestError } from "./http-client.ts";
import { contentHash } from "./hash.ts";
import type { SourceAuditRecord } from "./types.ts";
import { syncFavoriteOpportunityReminders } from "../reminders/store.ts";
import { ensureOfficialUrlLifecycle } from "../official-url-lifecycle.ts";

type SqlClient = ReturnType<typeof neon<false, false>>;

const DEFAULT_ACTIVE_MONTHS = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12];
const MAX_SOURCES_PER_RUN = 8;
const SOURCE_SCAN_CONCURRENCY = 4;
const RECRUITMENT_SIGNAL = /招聘|校招|校园|应届|毕业生|春招|秋招|实习|管培|报名|网申/;

type SourceRow = {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  source_domain: string;
  source_url: string | null;
  list_page_url: string | null;
  source_type: string | null;
  source_category: string | null;
  source_level: string;
  discovery_status: string;
  automation_allowed: boolean;
  incremental_sync_enabled: boolean;
  requires_login: boolean;
  has_captcha: boolean;
  requires_javascript: boolean;
  request_interval_seconds: number;
  max_requests_per_run: number;
  max_requests_per_day: number;
  user_agent: string | null;
  last_verified_at: string | null;
  content_fingerprint: string | null;
  next_check_at: string | null;
  normal_frequency: string | null;
  active_frequency: string | null;
  sync_active_months: number[] | null;
};

function json(value: unknown) {
  return JSON.stringify(value);
}

async function digestUuid(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const chars = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const value32 = chars.join("");
  return `${value32.slice(0, 8)}-${value32.slice(8, 12)}-${value32.slice(12, 16)}-${value32.slice(16, 20)}-${value32.slice(20)}`;
}

function decodeHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

function pageTitle(html: string, fallback: string) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || fallback;
}

function inferSeason(text: string, month: number) {
  if (/春招|春季/.test(text)) return "SPRING";
  if (/秋招|秋季/.test(text)) return "AUTUMN";
  return month >= 7 && month <= 12 ? "AUTUMN" : month >= 2 && month <= 5 ? "SPRING" : "OTHER";
}

function inferYear(text: string) {
  const year = text.match(/20\d{2}/)?.[0];
  return year ? Number(year) : null;
}

function opportunityType(sourceCategory: string | null, sourceName: string) {
  if (sourceCategory === "CENTRAL_SOE") return "CENTRAL_SOE";
  if (sourceCategory === "LOCAL_SOE") return "LOCAL_SOE";
  if (/银行|证券|保险/.test(sourceName)) return "BANK_CAMPUS";
  return "ENTERPRISE_CAMPUS";
}

function sourceRecord(source: SourceRow): SourceAuditRecord {
  return {
    id: source.id,
    organizationId: source.organization_id,
    sourceName: source.name,
    sourceDomain: source.source_domain,
    sourceUrl: source.source_url,
    listPageUrl: source.list_page_url,
    detailUrlPattern: null,
    apiUrl: null,
    rssUrl: null,
    robotsUrl: null,
    robotsResult: null,
    termsUrl: null,
    termsResult: null,
    requiresJavascript: source.requires_javascript,
    requiresLogin: source.requires_login,
    hasCaptcha: source.has_captcha,
    discoveryStatus: source.discovery_status as SourceAuditRecord["discoveryStatus"],
    automationAllowed: source.automation_allowed,
    incrementalSyncEnabled: source.incremental_sync_enabled,
    requestIntervalSeconds: Math.max(1, source.request_interval_seconds || 10),
    maxRequestsPerRun: source.max_requests_per_run || 20,
    maxRequestsPerDay: source.max_requests_per_day || 100,
    userAgent: source.user_agent,
    lastVerifiedAt: source.last_verified_at,
    legalNotes: null,
    technicalNotes: null,
  };
}

async function ensureIncrementalColumns(sql: SqlClient) {
  await sql`
    ALTER TABLE data_sources
      ADD COLUMN IF NOT EXISTS incremental_sync_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sync_active_months jsonb NOT NULL DEFAULT '[2,3,4,5,7,8,9,10,11,12]'
  `;
  await sql`ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS raw_source_item_id uuid REFERENCES raw_source_items(id)`;
  await sql`ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS claimed_at timestamptz`;
}

async function enableEligibleSources(sql: SqlClient) {
  const result = await sql`
    UPDATE data_sources
    SET incremental_sync_enabled = true,
        normal_frequency = 'EVERY_7_DAYS',
        active_frequency = 'DAILY',
        check_frequency = 'INCREMENTAL_SYNC',
        next_check_at = COALESCE(next_check_at, now()),
        updated_at = now()
    WHERE status = 'active'
      AND discovery_status = 'VERIFIED'
      AND official_url_status = 'PUBLISHED'
      AND level <> 'D级'
      AND requires_login = false
      AND has_captcha = false
      AND source_domain IS NOT NULL
      AND COALESCE(list_page_url, source_url) IS NOT NULL
      AND COALESCE(requires_javascript, false) = false
    RETURNING id
  `;
  return result.length;
}

async function dueSources(sql: SqlClient) {
  const rows = await sql`
    SELECT ds.id::text AS id, ds.organization_id::text AS organization_id,
           COALESCE(o.name, ds.name) AS organization_name, ds.name,
           ds.source_domain, ds.source_url, ds.list_page_url, ds.source_type,
           ds.source_category, ds.level AS source_level, ds.discovery_status,
           ds.automation_allowed, ds.incremental_sync_enabled, ds.requires_login,
           ds.has_captcha, ds.requires_javascript, ds.request_interval_seconds,
           ds.max_requests_per_run, ds.max_requests_per_day, ds.user_agent,
           ds.source_last_verified_at AS last_verified_at, ds.content_fingerprint,
           ds.next_check_at, ds.normal_frequency, ds.active_frequency,
           ds.sync_active_months
    FROM data_sources ds
    LEFT JOIN organizations o ON o.id = ds.organization_id
    WHERE ds.status = 'active'
      AND ds.incremental_sync_enabled = true
      AND ds.discovery_status = 'VERIFIED'
      AND ds.official_url_status = 'PUBLISHED'
      AND ds.requires_login = false AND ds.has_captcha = false
      AND ds.source_domain IS NOT NULL
      AND COALESCE(ds.list_page_url, ds.source_url) IS NOT NULL
      AND (ds.next_check_at IS NULL OR ds.next_check_at <= now())
    ORDER BY COALESCE(ds.next_check_at, to_timestamp(0)), o.priority NULLS LAST, ds.id
    LIMIT ${MAX_SOURCES_PER_RUN}
  `;
  return rows as SourceRow[];
}

function activeForMonth(source: SourceRow, month: number) {
  const activeMonths = Array.isArray(source.sync_active_months) && source.sync_active_months.length ? source.sync_active_months : DEFAULT_ACTIVE_MONTHS;
  return activeMonths.includes(month);
}

async function recordFailure(sql: SqlClient, source: SourceRow, runId: string, fetchRunId: string, error: unknown, now: Date, active: boolean) {
  const failureType = error instanceof SourceRequestError ? error.code : "NETWORK_ERROR";
  const message = error instanceof Error ? error.message : "来源增量采集失败";
  const blocked = ["HTTP_403", "HTTP_429", "SSRF_BLOCKED", "REDIRECT_BLOCKED"].includes(failureType);
  const nextHours = failureType === "HTTP_429" ? 24 * 7 : active ? 24 : 24 * 7;
  const nextCheck = new Date(now.getTime() + nextHours * 60 * 60 * 1000);
  await sql`
    UPDATE collection_runs SET finished_at = ${now}, status = ${blocked ? "blocked" : "failed"}, error_count = 1, error_message = ${message}, updated_at = now() WHERE id = ${runId}
  `;
  await sql`
    UPDATE source_fetch_runs SET finished_at = ${now}, run_status = ${blocked ? "BLOCKED" : "FAILED"}, request_count = 1, error_count = 1, error_message = ${message}, http_status_summary = ${json({ failureType })}::jsonb, updated_at = now() WHERE id = ${fetchRunId}
  `;
  await sql`
    UPDATE data_sources SET last_checked_at = ${now}, last_failed_fetch_at = ${now}, last_error = ${message}, consecutive_failure_count = consecutive_failure_count + 1, next_check_at = ${nextCheck}, updated_at = now() WHERE id = ${source.id}
  `;
  return { failureType, blocked, message };
}

async function scanSource(sql: SqlClient, source: SourceRow, now: Date, month: number, client: SafeSourceHttpClient) {
  const runId = await digestUuid(`incremental:collection:${source.id}:${now.toISOString()}`);
  const fetchRunId = await digestUuid(`incremental:fetch:${source.id}:${now.toISOString()}`);
  const active = activeForMonth(source, month);
  const nextCheck = new Date(now.getTime() + (active ? 24 : 24 * 7) * 60 * 60 * 1000);
  await sql`
    INSERT INTO collection_runs (id, data_source_id, trigger_type, started_at, status)
    VALUES (${runId}, ${source.id}, 'incremental_sync', ${now}, 'running')
  `;
  await sql`
    INSERT INTO source_fetch_runs (id, data_source_id, started_at, run_status)
    VALUES (${fetchRunId}, ${source.id}, ${now}, 'RUNNING')
  `;
  try {
    const target = source.list_page_url ?? source.source_url;
    if (!target) throw new SourceRequestError("来源缺少公开页面地址", "INVALID_URL");
    const response = await client.get(sourceRecord(source), target);
    const html = new TextDecoder().decode(response.body);
    const hash = await contentHash(response.body);
    const text = decodeHtml(html);
    const title = pageTitle(html, `${source.organization_name}招聘来源页面`);
    const changed = source.content_fingerprint !== hash;
    let rawInserted = 0;
    let stagingInserted = 0;
    let taskInserted = 0;
    let duplicateStatus = "unique";
    if (changed && RECRUITMENT_SIGNAL.test(`${title} ${text}`)) {
      const existingHash = await sql`SELECT id FROM raw_source_items WHERE data_source_id = ${source.id} AND content_hash = ${hash} LIMIT 1`;
      if (!existingHash.length) {
        const rawId = await digestUuid(`incremental:raw:${source.id}:${hash}`);
        const stagingId = await digestUuid(`incremental:staging:${rawId}`);
        const taskId = await digestUuid(`incremental:task:${rawId}`);
        const year = inferYear(`${title} ${text}`);
        const season = inferSeason(`${title} ${text}`, month);
        const projectName = title.slice(0, 180);
        const formalDuplicate = await sql`
          SELECT id FROM opportunities
          WHERE organization_id = ${source.organization_id}
            AND (official_announcement_url = ${response.url} OR official_application_url = ${response.url} OR title = ${projectName})
          LIMIT 1
        `;
        duplicateStatus = formalDuplicate.length ? "suspected" : "unique";
        const summary = text.slice(0, 1200);
        const payload = { mode: "INCREMENTAL_SYNC", sourceName: source.name, sourceUrl: response.url, contentHash: hash, activePeriod: active ? "DAILY" : "EVERY_7_DAYS", changed, duplicateStatus };
        await sql`
          INSERT INTO raw_source_items (
            id, data_source_id, collection_run_id, source_url, original_title,
            original_content, original_html, published_at, collected_at,
            content_hash, previous_content_hash, content_summary, previous_content_summary,
            parser_name, parser_result, normalized_payload, parse_status, review_status, duplicate_status
          ) VALUES (
            ${rawId}, ${source.id}, ${runId}, ${response.url}, ${projectName},
            ${text.slice(0, 200000)}, ${html.slice(0, 1800000)}, NULL, ${now},
            ${hash}, ${source.content_fingerprint}, ${summary}, ${source.content_fingerprint ? "页面指纹发生变化，旧版本正文未被覆盖。" : null},
            'incremental-html-snapshot-v1', ${json(payload)}::jsonb, ${json({ title: projectName, source: source.organization_name, recruitmentYear: year, recruitmentSeason: season, officialAnnouncementUrl: response.url })}::jsonb,
            'partial', 'pending', ${duplicateStatus}
          )
        `;
        rawInserted = 1;
        await sql`
          INSERT INTO staging_opportunities (
            id, raw_source_item_id, data_source_id, organization_id, company_name,
            project_name, opportunity_type, recruitment_season, recruitment_year,
            recruitment_batch, graduation_years, degree_requirements, original_major_text,
            normalized_major_names, major_categories, work_locations, published_at,
            announcement_url, application_url, deadline_type, relevance_status,
            validation_errors, dedupe_key, review_status, reviewer_note
          ) VALUES (
            ${stagingId}, ${rawId}, ${source.id}, ${source.organization_id}, ${source.organization_name},
            ${projectName}, ${opportunityType(source.source_category, source.name)}, ${season}, ${year},
            NULL, ${json(year ? [year] : [])}::jsonb, '[]'::jsonb, '页面快照未能可靠解析专业要求，需管理员打开官方来源核验',
            '[]'::jsonb, '[]'::jsonb, ${json(["待管理员核验"])}::jsonb, NULL,
            ${response.url}, ${response.url}, ${detectDeadlineType(text)}, 'CURRENT_OPEN',
            ${json(["增量页面快照，需人工核验招聘项目、时间、专业、地区和官方报名链接"])}::jsonb,
            ${`${source.organization_id}:${projectName}:${year ?? "unknown"}:${season}:${response.url}`}, 'PENDING', ${changed ? "页面内容发生变化，禁止自动覆盖正式信息。" : "新发现页面快照，等待管理员审核。"}
          )
        `;
        stagingInserted = 1;
        await sql`
          INSERT INTO admin_tasks (id, task_type, status, priority, raw_source_item_id, due_at, admin_note)
          VALUES (${taskId}, ${changed ? "page_changed" : "new_recruitment"}, 'open', ${changed ? "high" : "medium"}, ${rawId}, ${new Date(now.getTime() + 24 * 60 * 60 * 1000)}, ${changed ? "页面内容发生变化；请比较新旧摘要并人工核验，不能自动覆盖正式招聘信息。" : "新发现公开招聘来源页面；请人工确认是否为新的招聘项目。"})
          ON CONFLICT (id) DO NOTHING
        `;
        taskInserted = 1;
      }
    }
    await sql`
      UPDATE collection_runs SET finished_at = ${now}, status = 'success', fetched_count = 1, created_count = ${rawInserted}, changed_count = ${changed ? 1 : 0}, updated_at = now() WHERE id = ${runId}
    `;
    await sql`
      UPDATE source_fetch_runs SET finished_at = ${now}, run_status = 'SUCCESS', request_count = 1, discovered_count = ${changed ? 1 : 0}, created_count = ${rawInserted}, updated_count = ${changed ? 1 : 0}, updated_at = now() WHERE id = ${fetchRunId}
    `;
    await sql`
      UPDATE data_sources SET last_checked_at = ${now}, last_successful_collected_at = ${now}, last_changed_at = CASE WHEN ${changed} THEN ${now} ELSE last_changed_at END, content_fingerprint = ${hash}, last_error = NULL, consecutive_failure_count = 0, next_check_at = ${nextCheck}, updated_at = now() WHERE id = ${source.id}
    `;
    return { status: "SUCCESS", active, changed, rawInserted, stagingInserted, taskInserted, duplicateStatus, failureType: null as string | null };
  } catch (error) {
    const failure = await recordFailure(sql, source, runId, fetchRunId, error, now, active);
    return { status: failure.blocked ? "BLOCKED" : "FAILED", active, changed: false, rawInserted: 0, stagingInserted: 0, taskInserted: 0, duplicateStatus: null, failureType: failure.failureType };
  }
}

export async function runIncrementalSync(options: { databaseUrl?: string; triggerType?: string; now?: Date } = {}) {
  const sql = neon(options.databaseUrl ?? process.env.DATABASE_URL ?? "");
  const now = options.now ?? new Date();
  const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "numeric" }).format(now));
  await ensureIncrementalColumns(sql);
  await ensureOfficialUrlLifecycle(sql);
  const enabled = await enableEligibleSources(sql);
  const sources = await dueSources(sql);
  const client = new SafeSourceHttpClient({ policy: { maxRetries: 0, timeoutMs: 12_000, maxResponseBytes: 2_000_000 } });
  const results: Array<Awaited<ReturnType<typeof scanSource>>> = [];
  for (let offset = 0; offset < sources.length; offset += SOURCE_SCAN_CONCURRENCY) {
    const batch = sources.slice(offset, offset + SOURCE_SCAN_CONCURRENCY);
    results.push(...await Promise.all(batch.map((source) => scanSource(sql, source, now, month, client))));
  }

  const favoriteRows = await sql`SELECT DISTINCT opportunity_id::text AS opportunity_id FROM opportunity_favorites WHERE deleted_at IS NULL`;
  let reminderFavorites = 0;
  let reminderDeliveries = 0;
  for (const row of favoriteRows) {
    const reminder = await syncFavoriteOpportunityReminders(String(row.opportunity_id));
    reminderFavorites += reminder.favorites;
    reminderDeliveries += reminder.scheduled;
  }
  const failureTypes = Object.fromEntries(Array.from(new Set(results.map((item) => item.failureType).filter(Boolean))).map((type) => [type as string, results.filter((item) => item.failureType === type).length]));
  return {
    ok: true,
    mode: "INCREMENTAL_SYNC",
    triggerType: options.triggerType ?? "manual_cron",
    executedAt: now.toISOString(),
    activePeriod: month >= 7 && month <= 12 ? "AUTUMN_DAILY" : month >= 2 && month <= 5 ? "SPRING_DAILY" : "BASELINE_EVERY_7_DAYS",
    policy: { activeMonths: DEFAULT_ACTIVE_MONTHS, activeFrequency: "DAILY", baselineFrequency: "EVERY_7_DAYS", maxSourcesPerRun: MAX_SOURCES_PER_RUN, scanConcurrency: SOURCE_SCAN_CONCURRENCY, bypassLoginCaptchaOrAccessRestrictions: false },
    sourceSummary: { eligibleEnabled: enabled, due: sources.length, scanned: results.length, unchanged: results.filter((item) => item.status === "SUCCESS" && !item.changed).length, changed: results.filter((item) => item.changed).length, blocked: results.filter((item) => item.status === "BLOCKED").length, failed: results.filter((item) => item.status === "FAILED").length, failureTypes },
    pipeline: { rawInserted: results.reduce((sum, item) => sum + item.rawInserted, 0), stagingInserted: results.reduce((sum, item) => sum + item.stagingInserted, 0), reviewTasksCreated: results.reduce((sum, item) => sum + item.taskInserted, 0), opportunitiesAutoPublished: 0, note: "新增和变化只进入raw_source_items、staging_opportunities与人工审核任务；不会自动覆盖或发布正式机会。" },
    reminders: { favoritesScanned: reminderFavorites, deliveriesSynchronized: reminderDeliveries },
    details: results,
  };
}
