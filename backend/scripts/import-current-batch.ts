import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

type CollectedItem = {
  id: string;
  batch_id: string;
  source_url: string;
  source_domain: string;
  title: string;
  raw_text: string;
  published_at: string | null;
  fetched_at: string;
  content_hash: string;
  parser_name: string;
  parse_status: "success" | "partial" | "failed";
  review_status: string;
  duplicate_status: "unique" | "suspected" | "confirmed" | "not_duplicate";
  normalized: Record<string, unknown>;
  decision: string;
};

const batchPath = resolve(process.cwd(), "logs/national-collection/2026-08-11/raw_source_items.json");
const publishVerifiedPdd = process.argv.includes("--publish-verified-pdd");

/**
 * The production app uses Neon HTTP, whose Drizzle adapter does not expose
 * interactive transactions. The Neon client does support a real, non-
 * interactive transaction, so this importer builds one ordered query batch.
 */
function stableUuid(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
  const versioned = `${hex.slice(0, 12)}4${hex.slice(13)}`;
  const variant = `${versioned.slice(0, 16)}${((parseInt(versioned[16], 16) & 0x3) | 0x8).toString(16)}${versioned.slice(17)}`;
  return `${variant.slice(0, 8)}-${variant.slice(8, 12)}-${variant.slice(12, 16)}-${variant.slice(16, 20)}-${variant.slice(20)}`;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function sourceCategory(item: CollectedItem) {
  const type = String(item.normalized.type ?? "");
  if (type === "PROVINCIAL_CIVIL_SERVICE") return "PROVINCIAL_CIVIL_SERVICE";
  if (type === "NATIONAL_CIVIL_SERVICE") return "NATIONAL_CIVIL_SERVICE";
  return "ENTERPRISE";
}

function opportunityType(item: CollectedItem) {
  const type = String(item.normalized.type ?? "");
  if (type === "PROVINCIAL_CIVIL_SERVICE") return "PROVINCIAL_CIVIL_SERVICE";
  if (type === "NATIONAL_CIVIL_SERVICE") return "NATIONAL_CIVIL_SERVICE";
  return "ENTERPRISE_CAMPUS";
}

function isPdd(item: CollectedItem) {
  return item.source_domain === "careers.pddglobalhr.com";
}

function dedupeKey(item: CollectedItem, organizationId: string) {
  const year = item.normalized.year == null ? "不限" : String(item.normalized.year);
  const batch = String(item.normalized.batch ?? "未标明批次");
  return `${organizationId}:${item.title.trim()}:${year}:${batch}`;
}

async function countRows(sql: any) {
  const result = await sql`
    SELECT
      (SELECT count(*)::int FROM organizations) AS organizations,
      (SELECT count(*)::int FROM data_sources) AS data_sources,
      (SELECT count(*)::int FROM raw_source_items) AS raw_source_items,
      (SELECT count(*)::int FROM staging_opportunities) AS staging_opportunities,
      (SELECT count(*)::int FROM opportunities) AS opportunities
  `;
  return result[0] as Record<string, number>;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required; current batch was not imported.");
  const items = JSON.parse(await readFile(batchPath, "utf8")) as CollectedItem[];
  const sql = neon(databaseUrl);
  const before = await countRows(sql);
  const queries: any[] = [];

  for (const item of items) {
    const organizationName = String(item.normalized.organization ?? item.source_domain);
    const organizationId = stableUuid(`organization:${organizationName}`);
    const sourceId = stableUuid(`source:${item.source_url}`);
    const rawId = stableUuid(`raw:${item.id}`);
    const key = dedupeKey(item, organizationId);
    const stagingId = stableUuid(`staging:${key}`);
    const verifiedPdd = isPdd(item) && item.review_status === "approved";
    const shouldPublish = publishVerifiedPdd && verifiedPdd;
    const opportunityId = stableUuid(`opportunity:${key}`);
    const type = String(item.normalized.type ?? "");
    const isGovernment = type.includes("CIVIL_SERVICE") || item.source_domain.endsWith("gov.cn");
    const normalizedYear = item.normalized.year == null ? null : Number(item.normalized.year);
    const batchName = String(item.normalized.batch ?? "未标明批次");
    const deadlineType = String(item.normalized.deadline_type ?? "NOT_ANNOUNCED");

    queries.push(sql`
      INSERT INTO organizations (id, name, short_name, organization_type, level, priority, status)
      VALUES (${organizationId}, ${organizationName}, ${organizationName}, ${String(item.normalized.type ?? "招聘单位")}, ${isPdd(item) ? "重点官方来源" : "官方来源"}, ${isPdd(item) ? "P0" : "P1"}, 'active')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    `);

    queries.push(sql`
      INSERT INTO data_sources (
        id, name, organization_id, level, source_category, source_type,
        collection_method, source_url, source_domain, discovery_status,
        automation_allowed, requires_manual_review, check_frequency, status, admin_note
      )
      VALUES (
        ${sourceId}, ${`${organizationName}官方来源`}, ${organizationId},
        'A级', ${sourceCategory(item)}, ${isGovernment ? "政府官网" : "企业官网"},
        'HTML页面', ${item.source_url}, ${item.source_domain}, 'VERIFIED',
        false, true, 'manual', 'active', '本批次人工访问记录；自动采集权限仍关闭。'
      )
      ON CONFLICT (id) DO NOTHING
    `);

    queries.push(sql`
      INSERT INTO raw_source_items (
        id, data_source_id, source_url, original_title, original_content,
        attachment_urls, published_at, collected_at, content_hash,
        content_summary, parser_name, parser_result, normalized_payload,
        parse_status, review_status, duplicate_status
      )
      VALUES (
        ${rawId}, ${sourceId}, ${item.source_url}, ${item.title}, ${item.raw_text},
        '[]'::jsonb, ${item.published_at}, ${item.fetched_at}, ${item.content_hash},
        ${item.raw_text.slice(0, 400)}, ${item.parser_name},
        ${json({ externalId: item.id, batchId: item.batch_id, legacyReviewStatus: item.review_status, legacyDecision: item.decision })}::jsonb,
        ${json(item.normalized)}::jsonb, ${item.parse_status}, 'pending', ${item.duplicate_status}
      )
      ON CONFLICT (id) DO NOTHING
    `);

    queries.push(sql`
      INSERT INTO staging_opportunities (
        id, raw_source_item_id, data_source_id, organization_id,
        company_name, project_name, recruitment_batch, graduation_years,
        degree_requirements, original_major_text, normalized_major_names,
        major_categories, work_locations, published_at, announcement_url,
        application_url, relevance_status, validation_errors, dedupe_key,
        review_status, reviewer_note
      )
      VALUES (
        ${stagingId}, ${rawId}, ${sourceId}, ${organizationId},
        ${organizationName}, ${item.title}, ${batchName}, ${json(normalizedYear == null ? [] : [normalizedYear])}::jsonb,
        '[]'::jsonb, ${isPdd(item) ? "以官方岗位详情为准" : item.raw_text.slice(0, 500)},
        '[]'::jsonb, '[]'::jsonb, ${json([String(item.normalized.region ?? "全国")])}::jsonb,
        ${item.published_at}, ${item.source_url}, ${item.source_url},
        ${shouldPublish ? "CURRENT_OPEN" : "HISTORICAL"}, '[]'::jsonb, ${key},
        ${shouldPublish ? "APPROVED" : "PENDING"},
        ${shouldPublish ? "沿用批次日志中的人工核验结论；未绕过原始层。" : "待管理员在数据库审核工作台复核。"}
      )
      ON CONFLICT (id) DO NOTHING
    `);

    if (shouldPublish) {
      queries.push(sql`
        INSERT INTO opportunities (
          id, title, organization_id, opportunity_type, recruitment_season,
          recruitment_year, target_graduation_years, batch_name, description,
          work_locations, degree_requirements, major_requirement_text,
          official_announcement_url, official_application_url, source_id,
          source_level, verification_status, last_verified_at,
          publication_status, calculated_status, manual_status, deadline_type,
          opportunity_relevance_status, data_credibility, is_demo
        )
        VALUES (
          ${opportunityId}, ${item.title}, ${organizationId}, ${opportunityType(item)},
          ${item.normalized.season == null ? null : String(item.normalized.season)}, ${normalizedYear},
          ${json(normalizedYear == null ? [] : [normalizedYear])}::jsonb, ${batchName}, ${item.raw_text},
          '["全国"]'::jsonb, '[]'::jsonb, '以官方岗位详情为准',
          ${item.source_url}, ${item.source_url}, ${sourceId}, 'A级', 'verified', now(),
          'published', 'recruiting', 'recruiting', ${deadlineType}, 'CURRENT_OPEN',
          'A级官方页面 + 人工核验', false
        )
        ON CONFLICT (id) DO NOTHING
      `);

      queries.push(sql`
        UPDATE staging_opportunities
        SET promoted_opportunity_id = ${opportunityId}, review_status = 'APPROVED', reviewed_at = now(), updated_at = now()
        WHERE id = ${stagingId}
      `);

      queries.push(sql`
        UPDATE raw_source_items
        SET promoted_opportunity_id = ${opportunityId}, review_status = 'converted', reviewed_at = now(), updated_at = now()
        WHERE id = ${rawId}
      `);
    }
  }

  await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
  const after = await countRows(sql);
  const summary = {
    batch: batchPath,
    publishVerifiedPdd,
    inputItems: items.length,
    pddItemsPublished: items.filter((item) => publishVerifiedPdd && isPdd(item) && item.review_status === "approved").length,
    pendingReviewItems: items.filter((item) => !(publishVerifiedPdd && isPdd(item) && item.review_status === "approved")).length,
    inserted: {
      organizations: after.organizations - before.organizations,
      dataSources: after.data_sources - before.data_sources,
      rawSourceItems: after.raw_source_items - before.raw_source_items,
      stagingOpportunities: after.staging_opportunities - before.staging_opportunities,
      opportunities: after.opportunities - before.opportunities,
    },
    totals: after,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
