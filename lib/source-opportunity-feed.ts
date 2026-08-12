import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "../db";
import { ensureOfficialUrlLifecycle } from "./official-url-lifecycle";

type FeedSummary = {
  verifiedSources: number;
  activeRecruitment: number;
  upcomingRecruitment: number;
  officialEntryOnly: number;
  entriesCreated: number;
  entriesUpdated: number;
};

async function stableUuid(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const chars = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

function opportunityType(category: string | null, organizationType: string | null) {
  if (category === "CENTRAL_SOE") return "CENTRAL_SOE";
  if (category === "LOCAL_SOE") return "LOCAL_SOE";
  if (category === "NATIONAL_CIVIL_SERVICE") return "NATIONAL_CIVIL_SERVICE";
  if (category === "PROVINCIAL_CIVIL_SERVICE") return "PROVINCIAL_CIVIL_SERVICE";
  if (category === "GOVERNMENT") return "PUBLIC_INSTITUTION";
  if (organizationType?.includes("事业")) return "PUBLIC_INSTITUTION";
  return "ENTERPRISE_CAMPUS";
}

/**
 * Turns verified official source entries into a safe public feed. A source
 * without a concrete current project gets an official-entry record only; no
 * recruitment batch, date or requirement is invented here.
 */
export async function syncVerifiedSourcesToOpportunities(sourceId?: string): Promise<FeedSummary> {
  const sql = neon(getDatabaseUrl());
  await ensureOfficialUrlLifecycle(sql);
  await Promise.all([
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS recruitment_link_status text NOT NULL DEFAULT 'NEEDS_REVIEW'`,
    sql`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS display_type text NOT NULL DEFAULT 'RECRUITMENT_PROJECT'`,
  ]);

  const sources = sourceId
    ? await sql`
      SELECT s.id::text AS id, s.name, s.source_url, s.list_page_url, s.level,
             s.source_category, s.discovery_status, s.status,
             o.id::text AS organization_id, o.name AS organization_name,
             o.organization_type, o.industry
      FROM data_sources s
      JOIN organizations o ON o.id = s.organization_id
      WHERE s.id = ${sourceId}
        AND s.status = 'active'
        AND s.official_url_status = 'PUBLISHED'
        AND s.discovery_status IN ('VERIFIED', 'AUTO_ALLOWED')
        AND COALESCE(s.source_url, s.list_page_url) IS NOT NULL
    `
    : await sql`
      SELECT s.id::text AS id, s.name, s.source_url, s.list_page_url, s.level,
             s.source_category, s.discovery_status, s.status,
             o.id::text AS organization_id, o.name AS organization_name,
             o.organization_type, o.industry
      FROM data_sources s
      JOIN organizations o ON o.id = s.organization_id
      WHERE s.status = 'active'
        AND s.official_url_status = 'PUBLISHED'
        AND s.discovery_status IN ('VERIFIED', 'AUTO_ALLOWED')
        AND COALESCE(s.source_url, s.list_page_url) IS NOT NULL
    `;
  let activeRecruitment = 0;
  let upcomingRecruitment = 0;
  let officialEntryOnly = 0;
  let entriesCreated = 0;
  let entriesUpdated = 0;

  for (const source of sources) {
    const current = await sql`
      SELECT id::text AS id, opportunity_relevance_status
      FROM opportunities
      WHERE source_id = ${source.id}
        AND publication_status = 'published'
        AND is_demo = false
        AND display_type = 'RECRUITMENT_PROJECT'
        AND opportunity_relevance_status IN ('CURRENT_OPEN', 'UPCOMING')
    `;
    const linkStatus = current.some((item) => item.opportunity_relevance_status === "CURRENT_OPEN")
      ? "HAS_ACTIVE_RECRUITMENT"
      : current.length
        ? "UPCOMING_RECRUITMENT"
        : "OFFICIAL_ENTRY_ONLY";
    await sql`UPDATE data_sources SET recruitment_link_status = ${linkStatus}, updated_at = now() WHERE id = ${source.id}`;
    if (linkStatus === "HAS_ACTIVE_RECRUITMENT") activeRecruitment += 1;
    else if (linkStatus === "UPCOMING_RECRUITMENT") upcomingRecruitment += 1;
    else officialEntryOnly += 1;
    if (current.length) continue;

    const entryId = await stableUuid(`official-recruitment-entry:${source.id}`);
    const entryUrl = source.list_page_url ?? source.source_url;
    const result = await sql`
      INSERT INTO opportunities (
        id, title, display_type, organization_id, opportunity_type, batch_name,
        description, work_locations, education_requirements, degree_requirements,
        major_requirement_text, official_announcement_url, official_application_url,
        source_id, source_level, verification_status, last_verified_at,
        official_page_status, publication_status, calculated_status, deadline_type,
        opportunity_relevance_status, data_credibility, is_demo
      ) VALUES (
        ${entryId}, ${`${source.organization_name} · 官方招聘入口`}, 'OFFICIAL_RECRUITMENT_ENTRY',
        ${source.organization_id}, ${opportunityType(source.source_category, source.organization_type)},
        '官方招聘入口',
        ${`该入口已完成官方来源核验，当前未发现可直接发布的具体招聘批次。请以${source.organization_name}官网最新公告为准。`},
        ${JSON.stringify(["全国"])}, ${JSON.stringify(["以官方公告为准"])}, ${JSON.stringify(["以官方公告为准"])},
        '具体批次、专业和报名时间以官方公告为准', ${entryUrl}, ${entryUrl},
        ${source.id}, ${source.level}, 'verified', now(), 'accessible', 'published', 'pending_review',
        'NOT_ANNOUNCED', 'PUBLIC_NOTICE', '已核验', false
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, description = EXCLUDED.description,
        official_announcement_url = EXCLUDED.official_announcement_url,
        official_application_url = EXCLUDED.official_application_url,
        source_level = EXCLUDED.source_level, verification_status = 'verified',
        last_verified_at = now(), official_page_status = 'accessible',
        publication_status = 'published', display_type = 'OFFICIAL_RECRUITMENT_ENTRY',
        opportunity_relevance_status = 'PUBLIC_NOTICE', data_credibility = '已核验',
        updated_at = now()
      RETURNING (xmax = 0) AS inserted
    `;
    if (result[0]?.inserted) entriesCreated += 1;
    else entriesUpdated += 1;
  }

  return { verifiedSources: sources.length, activeRecruitment, upcomingRecruitment, officialEntryOnly, entriesCreated, entriesUpdated };
}
