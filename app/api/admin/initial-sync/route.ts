import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDatabaseUrl, getDb, schema } from "../../../../db";
import { eq } from "drizzle-orm";
import { batch1Records, batch1SourceAudits } from "../../../../data/collection/batch-1-real";

type SqlClient = ReturnType<typeof neon>;

function json(value: unknown) {
  return JSON.stringify(value);
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

async function countRows(sql: SqlClient) {
  const rows = await sql`
    SELECT
      (SELECT count(*)::int FROM regions) AS regions,
      (SELECT count(*)::int FROM majors) AS majors,
      (SELECT count(*)::int FROM organizations) AS organizations,
      (SELECT count(*)::int FROM data_sources) AS data_sources,
      (SELECT count(*)::int FROM raw_source_items) AS raw_source_items,
      (SELECT count(*)::int FROM staging_opportunities) AS staging_opportunities,
      (SELECT count(*)::int FROM opportunities) AS opportunities,
      (SELECT count(*)::int FROM opportunity_positions) AS opportunity_positions,
      (SELECT count(*)::int FROM opportunity_events) AS opportunity_events,
      (SELECT count(*)::int FROM opportunity_major_rules) AS opportunity_major_rules,
      (SELECT count(*)::int FROM favorites) AS favorites,
      (SELECT count(*)::int FROM notifications) AS notifications
  `;
  return rows[0] as Record<string, number>;
}

async function ensureNationalOpportunityModel(sql: SqlClient) {
  await sql`ALTER TYPE "opportunity_type" ADD VALUE IF NOT EXISTS 'BANK_CAMPUS'`;
  await sql`
    ALTER TABLE "opportunities"
      ADD COLUMN IF NOT EXISTS "verified_by" uuid REFERENCES "users"("id"),
      ADD COLUMN IF NOT EXISTS "next_verify_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "official_page_status" "official_page_status" NOT NULL DEFAULT 'unknown'
  `;
  await sql`
    ALTER TABLE "staging_opportunities"
      ADD COLUMN IF NOT EXISTS "opportunity_type" "opportunity_type",
      ADD COLUMN IF NOT EXISTS "recruitment_season" text,
      ADD COLUMN IF NOT EXISTS "recruitment_year" integer,
      ADD COLUMN IF NOT EXISTS "deadline_type" "deadline_type"
  `;
  await sql`
    ALTER TABLE "opportunity_positions"
      ADD COLUMN IF NOT EXISTS "organization_name" text,
      ADD COLUMN IF NOT EXISTS "department_name" text,
      ADD COLUMN IF NOT EXISTS "recruitment_count" integer,
      ADD COLUMN IF NOT EXISTS "education_requirement" text,
      ADD COLUMN IF NOT EXISTS "degree_requirement" text,
      ADD COLUMN IF NOT EXISTS "major_requirement_raw" text,
      ADD COLUMN IF NOT EXISTS "political_status_requirement" text,
      ADD COLUMN IF NOT EXISTS "fresh_graduate_requirement" text,
      ADD COLUMN IF NOT EXISTS "age_requirement" text,
      ADD COLUMN IF NOT EXISTS "household_requirement" text,
      ADD COLUMN IF NOT EXISTS "work_experience_requirement" text,
      ADD COLUMN IF NOT EXISTS "certificate_requirement" text,
      ADD COLUMN IF NOT EXISTS "region_id" uuid REFERENCES "regions"("id"),
      ADD COLUMN IF NOT EXISTS "remarks" text
  `;
  await sql`CREATE INDEX IF NOT EXISTS "opportunity_positions_region_idx" ON "opportunity_positions" ("region_id")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_positions_opportunity_code_uidx" ON "opportunity_positions" ("opportunity_id", "position_code") WHERE "position_code" IS NOT NULL`;
  await sql`ALTER TABLE "opportunity_major_rules" ADD COLUMN IF NOT EXISTS "rule_value" text, ADD COLUMN IF NOT EXISTS "major_category_id" uuid REFERENCES "major_categories"("id")`;
  await sql`CREATE INDEX IF NOT EXISTS "opportunity_major_rules_type_idx" ON "opportunity_major_rules" ("rule_type")`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "regions"("id");
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
}

function runStatus(status: string) {
  if (status === "SUCCESS" || status === "NO_ACTIVE_RECORD") return "SUCCESS";
  if (status === "REDIRECT_BLOCKED") return "BLOCKED";
  return "FAILED";
}

function collectionStatus(status: string) {
  if (status === "SUCCESS" || status === "NO_ACTIVE_RECORD") return "success";
  if (status === "REDIRECT_BLOCKED") return "blocked";
  return "failed";
}

export async function runBatch1(adminId: string | null) {
  const sql = neon(getDatabaseUrl());
  await ensureNationalOpportunityModel(sql);
  const before = await countRows(sql);
  const queries: any[] = [];
  const now = new Date().toISOString();
  const organizationIds = new Map<string, string>();
  const sourceIds = new Map<string, string>();
  const runIds = new Map<string, string>();
  const sourceFingerprints = new Map<string, string>();

  for (const source of batch1SourceAudits) {
    const organizationRow = await sql`SELECT id::text AS id FROM organizations WHERE name = ${source.organizationName} LIMIT 1`;
    const organizationId = organizationRow[0]?.id ?? await stableUuid(`batch1:organization:${source.organizationName}`);
    organizationIds.set(source.organizationName, organizationId);
    if (!organizationRow[0]) {
      queries.push(sql`
        INSERT INTO organizations (id, name, short_name, organization_type, industry, priority, status)
        VALUES (${organizationId}, ${source.organizationName}, ${source.organizationName}, '互联网与科技', '互联网与科技', 'P1', 'active')
        ON CONFLICT (name) DO NOTHING
      `);
    }

    const sourceRow = await sql`SELECT id::text AS id FROM data_sources WHERE source_url = ${source.sourceUrl} LIMIT 1`;
    const sourceId = sourceRow[0]?.id ?? await stableUuid(`batch1:data-source:${source.sourceUrl}`);
    sourceIds.set(source.key, sourceId);
    const fingerprint = await digestHex(`${source.sourceUrl}|${source.note}|${source.status}`);
    sourceFingerprints.set(source.key, fingerprint);
    if (!sourceRow[0]) {
      queries.push(sql`
        INSERT INTO data_sources (
          id, name, organization_id, level, source_category, source_type,
          collection_method, source_url, source_domain, discovery_status,
          automation_allowed, requires_manual_review, check_frequency,
          normal_frequency, active_frequency, status, admin_note
        ) VALUES (
          ${sourceId}, ${source.sourceName}, ${organizationId}, 'A级', 'ENTERPRISE', ${source.sourceType},
          'HTML页面', ${source.sourceUrl}, ${source.sourceDomain}, 'VERIFIED',
          false, true, 'manual', 'EVERY_7_DAYS', 'DAILY', 'active',
          ${source.note}
        ) ON CONFLICT (id) DO NOTHING
      `);
    } else {
      queries.push(sql`
        UPDATE data_sources SET
          name = ${source.sourceName},
          organization_id = ${organizationId},
          discovery_status = 'VERIFIED',
          requires_manual_review = true,
          automation_allowed = false,
          admin_note = ${source.note},
          updated_at = now()
        WHERE id = ${sourceId}
      `);
    }

    const runId = await stableUuid(`batch1:collection-run:${source.key}`);
    const fetchRunId = await stableUuid(`batch1:source-fetch-run:${source.key}`);
    runIds.set(source.key, runId);
    queries.push(sql`
      INSERT INTO collection_runs (
        id, data_source_id, trigger_type, started_at, finished_at, status,
        fetched_count, created_count, changed_count, error_count, error_message
      ) VALUES (
        ${runId}, ${sourceId}, 'initial_sync_batch_1', ${now}, now(), ${collectionStatus(source.status)},
        1, ${source.discoveredCount}, 0, ${source.failureType ? 1 : 0}, ${source.failureType ? source.note : null}
      ) ON CONFLICT (id) DO UPDATE SET
        finished_at = EXCLUDED.finished_at,
        status = EXCLUDED.status,
        fetched_count = EXCLUDED.fetched_count,
        created_count = EXCLUDED.created_count,
        error_count = EXCLUDED.error_count,
        error_message = EXCLUDED.error_message,
        updated_at = now()
    `);
    queries.push(sql`
      INSERT INTO source_fetch_runs (
        id, data_source_id, started_at, finished_at, run_status,
        request_count, discovered_count, created_count, updated_count,
        skipped_count, duplicate_count, error_count, http_status_summary,
        error_message, log_path
      ) VALUES (
        ${fetchRunId}, ${sourceId}, ${now}, now(), ${runStatus(source.status)},
        1, ${source.discoveredCount}, ${source.discoveredCount}, 0,
        0, 0, ${source.failureType ? 1 : 0}, ${json({ status: source.status, failureType: source.failureType })}::jsonb,
        ${source.failureType ? source.note : null}, 'batch-1-real.ts'
      ) ON CONFLICT (id) DO UPDATE SET
        finished_at = EXCLUDED.finished_at,
        run_status = EXCLUDED.run_status,
        request_count = EXCLUDED.request_count,
        discovered_count = EXCLUDED.discovered_count,
        created_count = EXCLUDED.created_count,
        error_count = EXCLUDED.error_count,
        http_status_summary = EXCLUDED.http_status_summary,
        error_message = EXCLUDED.error_message,
        updated_at = now()
    `);
    queries.push(sql`
      UPDATE data_sources SET
        last_checked_at = now(),
        last_successful_collected_at = CASE WHEN ${source.status === "SUCCESS" || source.status === "NO_ACTIVE_RECORD"} THEN now() ELSE last_successful_collected_at END,
        last_changed_at = CASE WHEN ${source.discoveredCount > 0} THEN now() ELSE last_changed_at END,
        content_fingerprint = ${fingerprint},
        last_error = ${source.failureType ? source.note : null},
        failure_count = CASE WHEN ${Boolean(source.failureType)} THEN failure_count + 1 ELSE 0 END,
        next_check_at = now() + interval '1 day',
        updated_at = now()
      WHERE id = ${sourceId}
    `);
  }

  const existingOpportunityIds = new Map<string, string>();
  const existingRawIds = new Set<string>();
  const existingStagingIds = new Set<string>();
  const recordMeta: Array<{ record: typeof batch1Records[number]; sourceId: string; organizationId: string; rawId: string; stagingId: string; opportunityId: string; contentHash: string; duplicate: boolean; rawExists: boolean; stagingExists: boolean }> = [];

  for (const record of batch1Records) {
    const organizationId = organizationIds.get(record.organizationName) ?? await stableUuid(`batch1:organization:${record.organizationName}`);
    const sourceId = sourceIds.get(record.sourceKey) as string;
    const rawId = await stableUuid(`batch1:raw:${record.externalId}`);
    const stagingId = await stableUuid(`batch1:staging:${record.externalId}`);
    const opportunityId = await stableUuid(`batch1:opportunity:${record.externalId}`);
    const contentHash = await digestHex(record.originalContent);
    const existingOpportunity = await sql`
      SELECT id::text AS id FROM opportunities
      WHERE organization_id = ${organizationId}
        AND title = ${record.title}
        AND recruitment_year = ${record.recruitmentYear}
        AND recruitment_season = ${record.recruitmentSeason}
        AND batch_name = ${record.batchName}
        AND (official_announcement_url = ${record.officialAnnouncementUrl} OR official_application_url = ${record.officialApplicationUrl})
      LIMIT 1
    `;
    const existingRaw = await sql`SELECT id::text AS id FROM raw_source_items WHERE id = ${rawId} LIMIT 1`;
    const existingStaging = await sql`SELECT id::text AS id FROM staging_opportunities WHERE id = ${stagingId} LIMIT 1`;
    if (existingOpportunity[0]?.id) existingOpportunityIds.set(record.externalId, existingOpportunity[0].id);
    if (existingRaw[0]?.id) existingRawIds.add(record.externalId);
    if (existingStaging[0]?.id) existingStagingIds.add(record.externalId);
    recordMeta.push({ record, sourceId, organizationId, rawId, stagingId, opportunityId, contentHash, duplicate: Boolean(existingOpportunity[0]?.id), rawExists: Boolean(existingRaw[0]?.id), stagingExists: Boolean(existingStaging[0]?.id) });
  }

  for (const item of recordMeta) {
    const { record, sourceId, organizationId, rawId, stagingId, opportunityId, contentHash, duplicate, rawExists, stagingExists } = item;
    const deadline = record.deadlineAt ? `${record.deadlineAt}T23:59:59+08:00` : null;
    const publishedAt = record.publishedAt ? `${record.publishedAt}T00:00:00+08:00` : null;
    if (!rawExists) {
      queries.push(sql`
        INSERT INTO raw_source_items (
          id, data_source_id, collection_run_id, source_url, original_title,
          original_content, attachment_urls, published_at, collected_at,
          content_hash, content_summary, parser_name, parser_result,
          normalized_payload, parse_status, review_status, duplicate_status
        ) VALUES (
          ${rawId}, ${sourceId}, ${runIds.get(record.sourceKey)}, ${record.officialAnnouncementUrl}, ${record.title},
          ${record.originalContent}, '[]'::jsonb, ${publishedAt}, now(),
          ${contentHash}, ${record.sourceEvidence}, 'official-source-audit-v1',
          ${json({ batch: "BATCH_1", evidence: record.sourceEvidence, sourceUrl: record.officialAnnouncementUrl })}::jsonb,
          ${json(record)}::jsonb, 'success', ${duplicate ? "pending" : "converted"}, ${duplicate ? "confirmed" : "unique"}
        )
      `);
    }
    if (!stagingExists) {
      queries.push(sql`
        INSERT INTO staging_opportunities (
          id, raw_source_item_id, data_source_id, organization_id, company_name,
          project_name, opportunity_type, recruitment_season, recruitment_year,
          recruitment_batch, graduation_years, degree_requirements,
          original_major_text, normalized_major_names, major_categories,
          work_locations, published_at, deadline, announcement_url,
          application_url, deadline_type, relevance_status, validation_errors,
          dedupe_key, review_status, reviewer_note, reviewed_by, reviewed_at
        ) VALUES (
          ${stagingId}, ${rawId}, ${sourceId}, ${organizationId}, ${record.organizationName},
          ${record.title}, ${record.opportunityType}, ${record.recruitmentSeason}, ${record.recruitmentYear},
          ${record.batchName}, ${json(record.targetGraduationYears)}::jsonb, ${json(record.degreeRequirements)}::jsonb,
          ${record.majorRequirementText}, '[]'::jsonb, '[]'::jsonb,
          ${json(record.workLocations)}::jsonb, ${record.publishedAt}, ${record.deadlineAt},
          ${record.officialAnnouncementUrl}, ${record.officialApplicationUrl}, ${record.deadlineType},
          'CURRENT_OPEN', '[]'::jsonb,
          ${`${organizationId}:${record.title}:${record.recruitmentYear}:${record.recruitmentSeason}:${record.batchName}:${record.officialAnnouncementUrl}`},
          ${duplicate ? "DUPLICATE" : "APPROVED"}, ${duplicate ? "与正式机会重复，未覆盖原记录。" : "本次由管理员按A级官方来源核验通过。"},
          ${adminId}, now()
        )
      `);
    }
    if (!duplicate && !existingOpportunityIds.has(record.externalId)) {
      queries.push(sql`
        INSERT INTO opportunities (
          id, title, organization_id, opportunity_type, recruitment_season,
          recruitment_year, target_graduation_years, batch_name, description,
          work_locations, recruitment_number, education_requirements,
          degree_requirements, major_requirement_text, official_announcement_url,
          official_application_url, source_id, source_level, verification_status,
          last_verified_at, verified_by, next_verify_at, official_page_status,
          publication_status, calculated_status, manual_status, deadline_type,
          deadline_at, opportunity_relevance_status, data_credibility, is_demo
        ) VALUES (
          ${opportunityId}, ${record.title}, ${organizationId}, ${record.opportunityType}, ${record.recruitmentSeason},
          ${record.recruitmentYear}, ${json(record.targetGraduationYears)}::jsonb, ${record.batchName}, ${record.originalContent},
          ${json(record.workLocations)}::jsonb, ${record.organizationName === "百度" ? 147 : null}, ${json(record.degreeRequirements)}::jsonb,
          ${json(record.degreeRequirements)}::jsonb, ${record.majorRequirementText}, ${record.officialAnnouncementUrl},
          ${record.officialApplicationUrl}, ${sourceId}, 'A级', 'verified', now(), ${adminId}, now() + interval '1 day', 'accessible',
          'published', ${record.opportunityStatus ?? "recruiting"}, ${record.opportunityStatus ?? "recruiting"}, ${record.deadlineType}, ${deadline}, 'CURRENT_OPEN', '已核验', false
        )
      `);
      queries.push(sql`
        INSERT INTO opportunity_major_rules (
          id, opportunity_id, rule_type, rule_value, original_text, requires_manual_review
        ) VALUES (
          ${await stableUuid(`batch1:major-rule:${record.externalId}`)}, ${opportunityId}, 'OTHER', 'OFFICIAL_DETAIL_REQUIRED', ${record.majorRequirementText}, true
        ) ON CONFLICT (id) DO NOTHING
      `);
      if (deadline) {
        queries.push(sql`
          INSERT INTO opportunity_events (
            id, opportunity_id, event_type, event_name, end_time, time_status,
            description, original_text, is_confirmed, source_url, last_verified_at
          ) VALUES (
            ${await stableUuid(`batch1:event:deadline:${record.externalId}`)}, ${opportunityId}, 'REGISTRATION_DEADLINE', '报名截止', ${deadline}, 'CONFIRMED',
            '官方页面公布的报名截止时间', ${record.sourceEvidence}, true, ${record.officialAnnouncementUrl}, now()
          ) ON CONFLICT (id) DO NOTHING
        `);
      }
      queries.push(sql`
        UPDATE raw_source_items SET promoted_opportunity_id = ${opportunityId}, review_status = 'converted', reviewed_by = ${adminId}, reviewed_at = now(), updated_at = now()
        WHERE id = ${rawId}
      `);
      queries.push(sql`
        UPDATE staging_opportunities SET promoted_opportunity_id = ${opportunityId}, review_status = 'APPROVED', reviewed_by = ${adminId}, reviewed_at = now(), updated_at = now()
        WHERE id = ${stagingId}
      `);
    }
    queries.push(sql`
      UPDATE opportunities
      SET calculated_status = ${record.opportunityStatus ?? "recruiting"},
          manual_status = ${record.opportunityStatus ?? "recruiting"},
          updated_at = now()
      WHERE id = ${opportunityId}
    `);
  }

  await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
  const after = await countRows(sql);
  const formalAdded = recordMeta.filter((item) => !item.duplicate && !existingOpportunityIds.has(item.record.externalId)).length;
  const duplicateFiltered = recordMeta.filter((item) => item.duplicate).length;
  const rawInserted = recordMeta.filter((item) => !item.rawExists).length;
  const stagingInserted = recordMeta.filter((item) => !item.stagingExists).length;
  const sourceSuccess = batch1SourceAudits.filter((source) => source.status === "SUCCESS" || source.status === "NO_ACTIVE_RECORD").length;

  return {
    ok: true,
    batch: "BATCH_1",
    executionMode: "manual_official_source_audit",
    executedAt: now,
    sourceReport: {
      attempted: batch1SourceAudits.length,
      successful: sourceSuccess,
      failed: batch1SourceAudits.length - sourceSuccess,
      failuresByType: Object.fromEntries(batch1SourceAudits.filter((source) => source.failureType).map((source) => [source.failureType as string, batch1SourceAudits.filter((item) => item.failureType === source.failureType).length])),
      details: batch1SourceAudits,
    },
    findings: {
      discovered: batch1Records.length,
      autumn: batch1Records.filter((record) => record.recruitmentSeason === "AUTUMN").length,
      spring: batch1Records.filter((record) => record.recruitmentSeason === "SPRING").length,
      internship: batch1Records.filter((record) => record.recruitmentSeason === "INTERNSHIP").length,
      rawInserted,
      stagingInserted,
      duplicateFiltered,
      formalAdded,
      awaitingManualReview: 0,
    },
    databaseBefore: before,
    databaseAfter: after,
    idempotency: {
      alreadyPresentRaw: recordMeta.filter((item) => item.rawExists).map((item) => item.record.title),
      alreadyPresentFormal: Array.from(existingOpportunityIds.keys()),
    },
  };
}

export async function GET() {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    return NextResponse.json({ ok: true, database: await countRows(sql), batch: "BATCH_1", status: "ready_to_run" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据库检查失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function POST() {
  try {
    const adminId = await requireAdmin();
    if (!adminId) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    return NextResponse.json(await runBatch1(adminId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "BATCH 1 执行失败";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
