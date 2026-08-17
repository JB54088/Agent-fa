import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";
import { dataSourcesSeed } from "../../../../db/seeds/data-sources";
import { nationalSourceDirectory } from "../../../../db/seeds/national-source-directory";
import { organizationsSeed } from "../../../../db/seeds/organizations";
import { enterpriseOfficialUrlCandidates, nationalSourceOfficialUrlCandidates } from "../../../../db/seeds/official-url-candidates";
import { additionalOfficialSourcesSeed } from "../../../../db/seeds/additional-official-sources";
import { ensureOfficialUrlLifecycle } from "../../../../lib/official-url-lifecycle";

type SqlClient = ReturnType<typeof neon>;

async function ensureFeedColumns(sql: SqlClient) {
  await Promise.all([
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS recruitment_link_status text NOT NULL DEFAULT 'NEEDS_REVIEW'`,
    sql`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS display_type text NOT NULL DEFAULT 'RECRUITMENT_PROJECT'`,
  ]);
}

async function digestHex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function stableUuid(value: string) {
  const hex = await digestHex(value);
  const chars = hex.slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
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

function normalFrequency(value: string) {
  if (value === "P0_PEAK_DAILY") return "DAILY";
  if (value === "P1_EVERY_2_3_DAYS" || value === "P2_WEEKLY") return "EVERY_7_DAYS";
  return "MANUAL";
}

function organizationForNationalSource(source: (typeof nationalSourceDirectory)[number]) {
  if (source.category === "NATIONAL_CIVIL_SERVICE") return { name: "国家公务员局", shortName: "国考", type: "公务员招录", industry: "公共管理", priority: "P0" };
  if (source.category === "PROVINCIAL_CIVIL_SERVICE") return { name: `${source.regionName ?? "全国"}公务员主管部门`, shortName: `${source.regionName ?? "全国"}省考`, type: "公务员招录", industry: "公共管理", priority: "P0" };
  if (source.category === "CENTRAL_SOE") return { name: "国务院国资委", shortName: "国资委", type: "央企目录", industry: "国资监管", priority: "P0" };
  if (source.category === "LOCAL_SOE") return { name: `${source.regionName ?? "全国"}国资监管部门`, shortName: `${source.regionName ?? "全国"}国企`, type: "地方国企目录", industry: "国资监管", priority: "P1" };
  return { name: "企业官方招聘发现目录", shortName: "企业来源发现", type: "企业招聘发现", industry: "招聘信息服务", priority: "P1" };
}

async function countDirectory(sql: SqlClient) {
  const rows = await sql`
    SELECT
      (SELECT count(*)::int FROM organizations) AS organizations,
      (SELECT count(*)::int FROM regions) AS regions,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%') AS registered_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND discovery_status = 'VERIFIED') AS verified_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND status = 'active' AND discovery_status = 'NEEDS_REVIEW') AS review_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'ENTERPRISE') AS enterprise_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'NATIONAL_CIVIL_SERVICE') AS national_civil_service_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'PROVINCIAL_CIVIL_SERVICE') AS provincial_civil_service_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'CENTRAL_SOE') AS central_soe_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'LOCAL_SOE') AS local_soe_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND recruitment_link_status = 'HAS_ACTIVE_RECRUITMENT') AS active_recruitment_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND recruitment_link_status = 'OFFICIAL_ENTRY_ONLY') AS official_entry_only_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND recruitment_link_status = 'UPCOMING_RECRUITMENT') AS upcoming_recruitment_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND status = 'invalid') AS disabled_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND failure_count > 0) AS access_failed_sources
  `;
  return rows[0] as Record<string, number>;
}

function unifiedStatus(row: { discovery_status: string; official_url_status: string; automation_allowed: boolean; status: string; failure_count: number; last_error: string | null }) {
  if (row.status === "invalid") return "DISABLED";
  if (row.failure_count > 0 || row.last_error) return "ACCESS_FAILED";
  if (row.official_url_status === "PUBLISHED" && row.discovery_status === "VERIFIED") return "VERIFIED";
  if (row.official_url_status !== "PUBLISHED") return "NEEDS_REVIEW";
  if (row.discovery_status === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  if (row.discovery_status === "DISCOVERED") return "DISCOVERED";
  if (row.discovery_status === "MANUAL_ONLY" || !row.automation_allowed) return "MANUAL_ONLY";
  if (row.discovery_status === "AUTO_ALLOWED" || row.automation_allowed) return "AUTO_ALLOWED";
  if (row.discovery_status === "VERIFIED") return "VERIFIED";
  return "ACTIVE";
}

async function listDirectory(sql: SqlClient) {
  const rows = await sql`
    SELECT s.id::text AS id, s.name AS source_name, s.source_url, s.list_page_url,
           s.source_domain, s.source_type, s.source_category, s.level AS source_level,
           s.discovery_status, s.automation_allowed, s.requires_manual_review,
           COALESCE(s.official_url_status, 'UNREGISTERED') AS official_url_status,
           s.official_url_registered_at, s.official_url_published_at,
           s.crawler_strategy, s.last_checked_at, s.source_last_verified_at,
           s.next_check_at, s.last_successful_collected_at, s.last_error,
           s.failure_count, s.status, s.admin_note, s.recruitment_link_status,
           o.name AS organization_name, o.organization_type, o.priority,
           COALESCE(r.name, '全国') AS region_name,
           (SELECT count(*)::int FROM opportunities p
              WHERE p.source_id = s.id AND p.publication_status = 'published'
                AND p.is_demo = false AND p.opportunity_relevance_status <> 'NOT_AN_OPPORTUNITY') AS opportunity_count
    FROM data_sources s
    LEFT JOIN organizations o ON o.id = s.organization_id
    LEFT JOIN regions r ON r.id = s.region_id
    WHERE s.admin_note LIKE '%source-directory-sync%'
    ORDER BY COALESCE(o.priority, 'P9'), o.name, s.name
  `;
  const sourceRows = rows.map((row) => ({
    id: row.id,
    name: row.source_name,
    company: row.organization_name ?? "未匹配企业",
    organizationType: row.organization_type ?? "官方来源",
    region: row.region_name,
    category: row.source_category,
    sourceType: row.source_type,
    level: row.source_level,
    sourceUrl: row.source_url ?? row.list_page_url ?? null,
    sourceDomain: row.source_domain,
    status: unifiedStatus(row),
    discoveryStatus: row.discovery_status,
    officialUrlStatus: row.official_url_status ?? "UNREGISTERED",
    officialUrlRegisteredAt: row.official_url_registered_at ? new Date(row.official_url_registered_at).toISOString() : null,
    officialUrlPublishedAt: row.official_url_published_at ? new Date(row.official_url_published_at).toISOString() : null,
    officialConfirmed: row.official_url_status === "PUBLISHED",
    automationAllowed: row.automation_allowed,
    requiresManualReview: row.requires_manual_review,
    crawlStrategy: row.crawler_strategy,
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null,
    lastVerifiedAt: row.source_last_verified_at ? new Date(row.source_last_verified_at).toISOString() : null,
    nextCheckAt: row.next_check_at ? new Date(row.next_check_at).toISOString() : null,
    lastSuccessfulCollectedAt: row.last_successful_collected_at ? new Date(row.last_successful_collected_at).toISOString() : null,
    failureCount: Number(row.failure_count ?? 0),
    lastError: row.last_error,
    recruitmentLinkStatus: row.recruitment_link_status ?? "NEEDS_REVIEW",
    opportunityCount: Number(row.opportunity_count ?? 0),
    priority: row.priority ?? "P2",
    note: row.admin_note?.replace(/\s*\[source-directory-sync:v1\]/g, "").replace(/\s*\[target-100-audit:v1\]/g, "").trim() ?? "",
  }));
  const stats = {
    total: sourceRows.length,
    verified: sourceRows.filter((row) => row.status === "VERIFIED" || row.officialConfirmed).length,
    needsReview: sourceRows.filter((row) => row.status === "NEEDS_REVIEW").length,
    accessFailed: sourceRows.filter((row) => row.status === "ACCESS_FAILED").length,
    autoAllowed: sourceRows.filter((row) => row.status === "AUTO_ALLOWED").length,
    manualOnly: sourceRows.filter((row) => row.status === "MANUAL_ONLY").length,
    discovered: sourceRows.filter((row) => row.status === "DISCOVERED").length,
    active: sourceRows.filter((row) => row.status === "ACTIVE").length,
    disabled: sourceRows.filter((row) => row.status === "DISABLED").length,
    enterprise: sourceRows.filter((row) => row.category === "ENTERPRISE").length,
    centralSoe: sourceRows.filter((row) => row.category === "CENTRAL_SOE").length,
    localSoe: sourceRows.filter((row) => row.category === "LOCAL_SOE").length,
    nationalAndProvincial: sourceRows.filter((row) => ["NATIONAL_CIVIL_SERVICE", "PROVINCIAL_CIVIL_SERVICE"].includes(row.category ?? "")).length,
    publicInstitution: sourceRows.filter((row) => row.category === "GOVERNMENT").length,
    militaryCivilian: sourceRows.filter((row) => row.category === "OTHER_OFFICIAL").length,
    activeRecruitment: sourceRows.filter((row) => row.recruitmentLinkStatus === "HAS_ACTIVE_RECRUITMENT").length,
    officialEntryOnly: sourceRows.filter((row) => row.recruitmentLinkStatus === "OFFICIAL_ENTRY_ONLY").length,
    upcomingRecruitment: sourceRows.filter((row) => row.recruitmentLinkStatus === "UPCOMING_RECRUITMENT").length,
    noCurrentRecruitment: sourceRows.filter((row) => row.recruitmentLinkStatus === "NO_CURRENT_RECRUITMENT").length,
    todayAdded: sourceRows.filter((row) => row.lastCheckedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    todayUpdated: sourceRows.filter((row) => row.lastVerifiedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
  };
  return { sourceRows, stats };
}

export async function GET() {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    await ensureOfficialUrlLifecycle(sql);
    await ensureFeedColumns(sql);
    const directory = await listDirectory(sql);
    return NextResponse.json({ ok: true, database: await countDirectory(sql), stats: directory.stats, sourceRows: directory.sourceRows, catalog: { enterprises: dataSourcesSeed.length, nationalSources: nationalSourceDirectory.length } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "全国来源目录检查失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    const body = await request.json().catch(() => ({})) as { mode?: string };
    await ensureFeedColumns(sql);

    if (body.mode === "add_additional_official_sources") {
      await ensureOfficialUrlLifecycle(sql);
      const organizationIds = new Map<string, string>();
      const queries: Array<ReturnType<SqlClient>> = [];
      let insertedSources = 0;

      for (const source of additionalOfficialSourcesSeed) {
        const existing = await sql`SELECT id::text AS id FROM organizations WHERE name = ${source.organizationName} LIMIT 1`;
        const id = existing[0]?.id ?? await stableUuid(`source-directory:organization:${source.organizationName}`);
        organizationIds.set(source.organizationName, id);
        queries.push(sql`
          INSERT INTO organizations (id, name, short_name, organization_type, industry, priority, status)
          VALUES (${id}, ${source.organizationName}, ${source.shortName}, ${source.organizationType}, ${source.industry}, ${source.priority}, 'active')
          ON CONFLICT (name) DO UPDATE SET short_name = EXCLUDED.short_name,
            organization_type = EXCLUDED.organization_type, industry = EXCLUDED.industry,
            priority = EXCLUDED.priority, updated_at = now()
        `);
      }

      for (const source of additionalOfficialSourcesSeed) {
        const organizationId = organizationIds.get(source.organizationName) as string;
        const existing = await sql`
          SELECT id::text AS id
          FROM data_sources
          WHERE organization_id = ${organizationId}
            AND (source_url = ${source.sourceUrl} OR name = ${source.sourceName})
          LIMIT 1
        `;
        const id = existing[0]?.id ?? await stableUuid(`source-directory:additional-official-source:${source.organizationName}`);
        if (!existing[0]) insertedSources += 1;
        const note = `${source.notes} [source-directory-sync:v1] [additional-official-candidate:v1]`;
        queries.push(sql`
          INSERT INTO data_sources (
            id, name, organization_id, level, source_category, source_type,
            collection_method, source_url, source_domain, crawler_strategy,
            discovery_status, automation_allowed, requires_manual_review,
            check_frequency, normal_frequency, active_frequency, status, admin_note
          ) VALUES (
            ${id}, ${source.sourceName}, ${organizationId}, 'A级', ${source.sourceCategory}, ${source.sourceType},
            '人工录入', ${source.sourceUrl}, ${source.sourceDomain}, 'MANUAL_SOURCE_AUDIT',
            'NEEDS_REVIEW', false, true, 'MANUAL', 'EVERY_7_DAYS', 'DAILY', 'active', ${note}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, organization_id = EXCLUDED.organization_id,
            source_category = EXCLUDED.source_category, source_type = EXCLUDED.source_type,
            source_url = EXCLUDED.source_url, source_domain = EXCLUDED.source_domain,
            discovery_status = CASE
              WHEN data_sources.official_url_status IN ('REGISTERED', 'PUBLISHED') THEN data_sources.discovery_status
              ELSE 'NEEDS_REVIEW'
            END,
            automation_allowed = false, requires_manual_review = true,
            check_frequency = EXCLUDED.check_frequency, normal_frequency = EXCLUDED.normal_frequency,
            active_frequency = EXCLUDED.active_frequency, admin_note = EXCLUDED.admin_note,
            updated_at = now()
        `);
      }

      await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
      return NextResponse.json({
        ok: true,
        mode: body.mode,
        summary: { candidateSources: additionalOfficialSourcesSeed.length, insertedSources },
        catalog: { enterpriseOrganizations: organizationsSeed.length + additionalOfficialSourcesSeed.length, enterpriseSources: dataSourcesSeed.length + additionalOfficialSourcesSeed.length, nationalSources: nationalSourceDirectory.length, regions: 0 },
        databaseAfter: await countDirectory(sql),
        safety: { automationAllowed: false, requiresManualReview: true, publishedOpportunitiesChanged: false },
      });
    }

    if (body.mode === "add_candidate_urls") {
      await ensureOfficialUrlLifecycle(sql);
      await sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS recruitment_link_status text NOT NULL DEFAULT 'NEEDS_REVIEW'`;
      const rows = await sql`
        SELECT s.id::text AS id, s.name AS source_name, s.organization_id::text AS organization_id,
               s.source_url, s.list_page_url, s.official_url_status, s.status,
               s.source_category, r.code AS region_code, o.name AS organization_name
        FROM data_sources s
        LEFT JOIN organizations o ON o.id = s.organization_id
        LEFT JOIN regions r ON r.id = s.region_id
        WHERE s.admin_note LIKE '%source-directory-sync%'
        ORDER BY o.name, s.name
      `;
      const updates: Array<ReturnType<SqlClient>> = [];
      const added: string[] = [];
      const protectedSources: string[] = [];
      const conflicts: string[] = [];
      const missing: string[] = [];
      const seenCandidates = new Set<string>();

      for (const row of rows) {
        let candidate = row.organization_name ? enterpriseOfficialUrlCandidates[row.organization_name] : undefined;
        if (!candidate && row.source_category === "LOCAL_SOE" && row.region_code) {
          candidate = nationalSourceOfficialUrlCandidates[`local-soe-${String(row.region_code).toLowerCase()}`];
        }
        if (!candidate) {
          missing.push(row.organization_name ? `${row.organization_name} · ${row.source_name}` : row.source_name);
          continue;
        }
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(candidate);
          if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("invalid_protocol");
        } catch {
          missing.push(`${row.organization_name ?? "未匹配企业"} · ${row.source_name}`);
          continue;
        }
        const normalizedUrl = parsedUrl.toString();
        const normalizedCandidate = normalizedUrl.toLowerCase().replace(/\/+$/, "");
        if (seenCandidates.has(`${row.organization_id}:${normalizedCandidate}`)) {
          conflicts.push(`${row.organization_name ?? "未匹配企业"} · ${row.source_name}`);
          continue;
        }
        seenCandidates.add(`${row.organization_id}:${normalizedCandidate}`);
        if (row.status !== "active" || row.official_url_status === "REGISTERED" || row.official_url_status === "PUBLISHED") {
          protectedSources.push(`${row.organization_name ?? "未匹配企业"} · ${row.source_name}`);
          continue;
        }
        const conflict = await sql`
          SELECT id::text AS id
          FROM data_sources
          WHERE id <> ${row.id}
            AND organization_id = ${row.organization_id}
            AND status = 'active'
            AND lower(regexp_replace(COALESCE(source_url, list_page_url), '/+$', '')) = ${normalizedCandidate}
          LIMIT 1
        `;
        if (conflict[0]) {
          conflicts.push(`${row.organization_name ?? "未匹配企业"} · ${row.source_name}`);
          continue;
        }
        updates.push(sql`
          UPDATE data_sources SET
            source_url = ${normalizedUrl}, source_domain = ${parsedUrl.hostname},
            official_url_status = COALESCE(official_url_status, 'UNREGISTERED'),
            discovery_status = 'NEEDS_REVIEW', recruitment_link_status = 'NEEDS_REVIEW',
            requires_manual_review = true, automation_allowed = false, incremental_sync_enabled = false,
            admin_note = concat(coalesce(admin_note, ''), ' [candidate-url-added:', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), ']'),
            updated_at = now()
          WHERE id = ${row.id}
        `);
        added.push(`${row.organization_name ?? "未匹配企业"} · ${row.source_name}`);
      }
      if (updates.length) await sql.transaction(updates, { isolationLevel: "ReadCommitted" });
      const databaseAfter = await countDirectory(sql);
      return NextResponse.json({
        ok: true,
        mode: body.mode,
        summary: {
          totalDirectorySources: rows.length,
          added: added.length,
          protected: protectedSources.length,
          conflicts: conflicts.length,
          missing: missing.length,
          pendingAfter: databaseAfter.review_sources,
        },
        details: { added, protected: protectedSources, conflicts, missing },
        safety: { officialUrlStatusChanged: false, publishedOpportunitiesChanged: false, automationAllowed: false, requiresManualReview: true },
      });
    }

    const queries: Array<ReturnType<SqlClient>> = [];
    const regionIds = new Map<string, string>();
    const organizationIds = new Map<string, string>();
    const sourceDirectoryMarker = "source-directory-sync:v1";
    const targetAuditMarker = "target-100-audit:v1";

    const regionSeeds = [
      { code: "CN", name: "全国", sortOrder: 0 },
      ...nationalSourceDirectory
        .filter((source) => source.regionCode && source.regionName)
        .map((source) => ({ code: source.regionCode as string, name: source.regionName as string, sortOrder: 10 }))
        .filter((region, index, all) => all.findIndex((item) => item.code === region.code) === index),
    ];
    for (const region of regionSeeds) {
      const id = await stableUuid(`source-directory:region:${region.code}`);
      regionIds.set(region.code, id);
      queries.push(sql`
        INSERT INTO regions (id, name, code, sort_order)
        VALUES (${id}, ${region.name}, ${region.code}, ${region.sortOrder})
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now()
      `);
    }

    for (const organization of [...organizationsSeed, ...additionalOfficialSourcesSeed]) {
      const existing = await sql`SELECT id::text AS id FROM organizations WHERE name = ${organization.name} LIMIT 1`;
      const id = existing[0]?.id ?? await stableUuid(`source-directory:organization:${organization.name}`);
      organizationIds.set(organization.name, id);
      queries.push(sql`
        INSERT INTO organizations (id, name, short_name, organization_type, industry, priority, status)
        VALUES (${id}, ${organization.name}, ${organization.shortName}, ${organization.organizationType}, ${organization.industry}, ${organization.priority}, 'active')
        ON CONFLICT (name) DO UPDATE SET short_name = EXCLUDED.short_name, organization_type = EXCLUDED.organization_type, industry = EXCLUDED.industry, priority = EXCLUDED.priority, updated_at = now()
      `);
    }

    for (const source of dataSourcesSeed) {
      const organizationId = organizationIds.get(source.organizationName) as string;
      const existing = source.sourceUrl
        ? await sql`SELECT id::text AS id FROM data_sources WHERE organization_id = ${organizationId} AND (source_url = ${source.sourceUrl} OR source_domain = ${source.sourceDomain}) LIMIT 1`
        : await sql`SELECT id::text AS id FROM data_sources WHERE organization_id = ${organizationId} AND name = ${source.sourceName} LIMIT 1`;
      const id = existing[0]?.id ?? await stableUuid(`source-directory:enterprise-source:${source.organizationName}`);
      const discoveryStatus = source.officialConfirmed ? "VERIFIED" : "NEEDS_REVIEW";
      const note = `${source.notes} [${sourceDirectoryMarker}] [${targetAuditMarker}]`;
      queries.push(sql`
        INSERT INTO data_sources (
          id, name, organization_id, level, source_category, source_type,
          collection_method, source_url, source_domain, crawler_strategy,
          list_page_url, robots_url, terms_url, requires_javascript,
          requires_login, has_captcha, discovery_status, automation_allowed,
          requires_manual_review, check_frequency, normal_frequency,
          active_frequency, status, admin_note, source_last_verified_at
        ) VALUES (
          ${id}, ${source.sourceName}, ${organizationId}, ${source.officialLevel}, 'ENTERPRISE', ${source.sourceType},
          '人工录入', ${source.sourceUrl}, ${source.sourceDomain}, ${source.crawlerStrategy},
          ${source.listPageUrl}, ${source.robotsUrl}, ${source.termsUrl}, ${source.requiresJavascript ?? false},
          ${source.requiresLogin ?? false}, ${source.hasCaptcha ?? false}, ${discoveryStatus}, false,
          true, ${source.recommendedFrequency}, ${normalFrequency(source.recommendedFrequency)},
          'DAILY', 'active', ${note}, ${source.lastVerifiedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, organization_id = EXCLUDED.organization_id,
          source_category = EXCLUDED.source_category, source_type = EXCLUDED.source_type,
          source_url = EXCLUDED.source_url, source_domain = EXCLUDED.source_domain,
          crawler_strategy = EXCLUDED.crawler_strategy, list_page_url = EXCLUDED.list_page_url,
          discovery_status = EXCLUDED.discovery_status, automation_allowed = false,
          requires_manual_review = true, check_frequency = EXCLUDED.check_frequency,
          normal_frequency = EXCLUDED.normal_frequency, active_frequency = EXCLUDED.active_frequency,
          admin_note = EXCLUDED.admin_note, source_last_verified_at = EXCLUDED.source_last_verified_at,
          updated_at = now()
      `);
    }

    for (const source of nationalSourceDirectory) {
      const owner = organizationForNationalSource(source);
      const existingOrg = await sql`SELECT id::text AS id FROM organizations WHERE name = ${owner.name} LIMIT 1`;
      const organizationId = existingOrg[0]?.id ?? await stableUuid(`source-directory:organization:${owner.name}`);
      organizationIds.set(owner.name, organizationId);
      queries.push(sql`
        INSERT INTO organizations (id, name, short_name, organization_type, industry, priority, status)
        VALUES (${organizationId}, ${owner.name}, ${owner.shortName}, ${owner.type}, ${owner.industry}, ${owner.priority}, 'active')
        ON CONFLICT (name) DO UPDATE SET short_name = EXCLUDED.short_name, organization_type = EXCLUDED.organization_type, industry = EXCLUDED.industry, priority = EXCLUDED.priority, updated_at = now()
      `);
      const id = await stableUuid(`source-directory:national-source:${source.id}`);
      const regionId = source.regionCode ? regionIds.get(source.regionCode) ?? null : null;
      const note = `${source.notes} [${sourceDirectoryMarker}]`;
      queries.push(sql`
        INSERT INTO data_sources (
          id, name, organization_id, region_id, level, source_category, source_type,
          collection_method, source_url, source_domain, discovery_status,
          automation_allowed, requires_manual_review, check_frequency,
          normal_frequency, active_frequency, status, admin_note, source_last_verified_at
        ) VALUES (
          ${id}, ${source.name}, ${organizationId}, ${regionId}, 'A级', ${source.category}, '政府官网',
          '人工录入', ${source.sourceUrl}, ${source.sourceDomain}, ${source.discoveryStatus},
          false, true, 'MANUAL_SOURCE_AUDIT', ${source.normalFrequency}, ${source.activeFrequency},
          'active', ${note}, ${source.lastVerifiedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, organization_id = EXCLUDED.organization_id, region_id = EXCLUDED.region_id,
          source_category = EXCLUDED.source_category, source_type = EXCLUDED.source_type,
          source_url = EXCLUDED.source_url, source_domain = EXCLUDED.source_domain,
          discovery_status = EXCLUDED.discovery_status, automation_allowed = false,
          requires_manual_review = true, check_frequency = EXCLUDED.check_frequency,
          normal_frequency = EXCLUDED.normal_frequency, active_frequency = EXCLUDED.active_frequency,
          admin_note = EXCLUDED.admin_note, source_last_verified_at = EXCLUDED.source_last_verified_at,
          updated_at = now()
      `);
    }

    await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
    return NextResponse.json({
      ok: true,
      mode: "source_directory_register",
      executedAt: new Date().toISOString(),
      catalog: { enterpriseOrganizations: organizationsSeed.length + additionalOfficialSourcesSeed.length, enterpriseSources: dataSourcesSeed.length + additionalOfficialSourcesSeed.length, nationalSources: nationalSourceDirectory.length, regions: regionSeeds.length },
      databaseAfter: await countDirectory(sql),
      safety: { automationAllowed: false, requiresManualReview: true, publishedOpportunitiesChanged: false },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "全国来源目录同步失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
