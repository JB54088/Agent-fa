import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";
import { dataSourcesSeed } from "../../../../db/seeds/data-sources";
import { nationalSourceDirectory } from "../../../../db/seeds/national-source-directory";
import { organizationsSeed } from "../../../../db/seeds/organizations";

type SqlClient = ReturnType<typeof neon>;

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
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND discovery_status = 'NEEDS_REVIEW') AS review_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'ENTERPRISE') AS enterprise_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'NATIONAL_CIVIL_SERVICE') AS national_civil_service_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'PROVINCIAL_CIVIL_SERVICE') AS provincial_civil_service_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'CENTRAL_SOE') AS central_soe_sources,
      (SELECT count(*)::int FROM data_sources WHERE admin_note LIKE '%source-directory-sync%' AND source_category = 'LOCAL_SOE') AS local_soe_sources
  `;
  return rows[0] as Record<string, number>;
}

export async function GET() {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    return NextResponse.json({ ok: true, database: await countDirectory(sql), catalog: { enterprises: dataSourcesSeed.length, nationalSources: nationalSourceDirectory.length } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "全国来源目录检查失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function POST() {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    const queries: Array<ReturnType<SqlClient>> = [];
    const regionIds = new Map<string, string>();
    const organizationIds = new Map<string, string>();
    const sourceDirectoryMarker = "source-directory-sync:v1";

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

    for (const organization of organizationsSeed) {
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
      const note = `${source.notes} [${sourceDirectoryMarker}]`;
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
      catalog: { enterpriseOrganizations: organizationsSeed.length, enterpriseSources: dataSourcesSeed.length, nationalSources: nationalSourceDirectory.length, regions: regionSeeds.length },
      databaseAfter: await countDirectory(sql),
      safety: { automationAllowed: false, requiresManualReview: true, publishedOpportunitiesChanged: false },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "全国来源目录同步失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
