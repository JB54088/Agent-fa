import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { buildSourcePoolImportPlan } from "../lib/source-pool/import-plan.ts";
import { normalizeUrl } from "../lib/source-pool/normalize.ts";

type SqlClient = ReturnType<typeof neon>;
type ExistingOrganization = { id: string; name: string; pool_organization_fingerprint: string | null };
type ExistingSource = { id: string; organization_id: string | null; pool_source_fingerprint: string | null; pool_normalized_url: string | null; source_url: string | null };

function stableUuid(key: string) {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
  const versioned = `${hex.slice(0, 12)}4${hex.slice(13)}`;
  const variant = `${versioned.slice(0, 16)}${((parseInt(versioned[16], 16) & 0x3) | 0x8).toString(16)}${versioned.slice(17)}`;
  return `${variant.slice(0, 8)}-${variant.slice(8, 12)}-${variant.slice(12, 16)}-${variant.slice(16, 20)}-${variant.slice(20)}`;
}

function asTimestamp(value: string | null) {
  return value ? `${value}T00:00:00.000Z` : null;
}

function sourceDomain(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function countRows(sql: SqlClient) {
  const rows = await sql`
    SELECT
      (SELECT count(*)::int FROM organizations) AS organizations,
      (SELECT count(*)::int FROM data_sources) AS data_sources,
      (SELECT count(*)::int FROM discovery_queue) AS discovery_queue,
      (SELECT count(*)::int FROM discovery_runs) AS discovery_runs
  `;
  return rows[0];
}

async function main() {
  const projectRoot = resolve(process.cwd());
  const plan = await buildSourcePoolImportPlan(projectRoot);
  const dryRun = process.argv.includes("--dry-run");
  const summary = {
    inputSources: plan.records.length,
    inputOrganizations: plan.organizationCount,
    duplicateSourceRecordsInInput: plan.duplicateSourceRecords,
    byCategory: plan.byCategory,
    dryRun,
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required. Use --dry-run to validate the import without writing to the database.");
  const sql = neon(databaseUrl);
  const before = await countRows(sql);
  const existingOrganizations = await sql`
    SELECT id, name, pool_organization_fingerprint FROM organizations
  ` as unknown as ExistingOrganization[];
  const existingSources = await sql`
    SELECT id, organization_id, pool_source_fingerprint, pool_normalized_url, source_url FROM data_sources
  ` as unknown as ExistingSource[];

  const organizationByFingerprint = new Map(existingOrganizations.filter((row) => row.pool_organization_fingerprint).map((row) => [row.pool_organization_fingerprint as string, row]));
  const organizationByName = new Map(existingOrganizations.map((row) => [row.name, row]));
  const sourceByFingerprint = new Map(existingSources.filter((row) => row.pool_source_fingerprint).map((row) => [row.pool_source_fingerprint as string, row]));
  const sourceByOrganizationUrl = new Map(existingSources.filter((row) => row.organization_id).map((row) => [`${row.organization_id}|${row.pool_normalized_url || normalizeUrl(row.source_url)}`, row]));

  const queries: any[] = [];
  const organizationIds = new Map<string, string>();
  const organizations = new Map(plan.records.map((record) => [record.organizationFingerprint, record]));
  let newOrganizations = 0;
  let updatedOrganizations = 0;
  let newSources = 0;
  let updatedSources = 0;

  for (const [fingerprint, record] of organizations) {
    const existing = organizationByFingerprint.get(fingerprint) || organizationByName.get(record.name);
    const organizationId = existing?.id ?? stableUuid(`organization|${fingerprint}`);
    organizationIds.set(fingerprint, organizationId);
    const aliases = JSON.stringify([record.name]);
    if (existing) {
      updatedOrganizations += 1;
      queries.push(sql`
        UPDATE organizations
        SET pool_normalized_name = ${record.normalizedOrganizationName},
            pool_aliases = CASE WHEN jsonb_array_length(COALESCE(pool_aliases, '[]'::jsonb)) = 0 THEN ${aliases}::jsonb ELSE pool_aliases END,
            pool_category = COALESCE(pool_category, ${record.poolCategory}),
            pool_organization_fingerprint = COALESCE(pool_organization_fingerprint, ${fingerprint}),
            pool_official_status = CASE WHEN pool_official_status = 'official' THEN pool_official_status ELSE ${record.officialStatus} END,
            pool_first_discovered_at = COALESCE(pool_first_discovered_at, ${asTimestamp(record.verifiedAt)}),
            pool_last_verified_at = ${asTimestamp(record.verifiedAt)},
            pool_discovery_method = COALESCE(pool_discovery_method, 'playwright_verified_import'),
            pool_discovered_from_url = COALESCE(pool_discovered_from_url, ${record.discoveredFromUrl}),
            updated_at = now()
        WHERE id = ${organizationId}
      `);
    } else {
      newOrganizations += 1;
      queries.push(sql`
        INSERT INTO organizations (
          id, name, organization_type, priority, status, monitoring_enabled,
          pool_normalized_name, pool_aliases, pool_category, pool_organization_fingerprint,
          pool_official_status, pool_first_discovered_at, pool_last_verified_at,
          pool_discovery_method, pool_discovered_from_url
        ) VALUES (
          ${organizationId}, ${record.name}, ${record.organizationType}, 'P1', 'active', false,
          ${record.normalizedOrganizationName}, ${aliases}::jsonb, ${record.poolCategory}, ${fingerprint},
          ${record.officialStatus}, ${asTimestamp(record.verifiedAt)}, ${asTimestamp(record.verifiedAt)},
          'playwright_verified_import', ${record.discoveredFromUrl}
        )
        ON CONFLICT (name) DO NOTHING
      `);
    }
  }

  for (const record of plan.records) {
    const organizationId = organizationIds.get(record.organizationFingerprint);
    if (!organizationId) throw new Error(`organization id missing for ${record.name}`);
    const sourceKey = `${organizationId}|${record.normalizedUrl}`;
    const existing = sourceByFingerprint.get(record.sourceFingerprint) || sourceByOrganizationUrl.get(sourceKey);
    const sourceId = existing?.id ?? stableUuid(`source|${record.sourceFingerprint}`);
    if (existing) {
      updatedSources += 1;
      queries.push(sql`
        UPDATE data_sources
        SET pool_category = COALESCE(pool_category, ${record.poolCategory}),
            pool_source_type = COALESCE(pool_source_type, ${record.poolSourceType}),
            pool_official_status = CASE WHEN pool_official_status = 'official' THEN pool_official_status ELSE ${record.officialStatus} END,
            pool_website_name = COALESCE(pool_website_name, ${record.pageTitle || record.name}),
            pool_url = COALESCE(pool_url, ${record.website || record.listedUrl || record.finalUrl}),
            pool_normalized_url = COALESCE(pool_normalized_url, ${record.normalizedUrl}),
            pool_source_fingerprint = COALESCE(pool_source_fingerprint, ${record.sourceFingerprint}),
            pool_first_discovered_at = COALESCE(pool_first_discovered_at, ${asTimestamp(record.verifiedAt)}),
            pool_last_verified_at = ${asTimestamp(record.verifiedAt)},
            pool_discovery_method = COALESCE(pool_discovery_method, 'playwright_verified_import'),
            pool_discovered_from_url = COALESCE(pool_discovered_from_url, ${record.discoveredFromUrl}),
            pool_status = COALESCE(pool_status, 'active'),
            updated_at = now()
        WHERE id = ${sourceId}
      `);
    } else {
      newSources += 1;
      const website = record.website || record.listedUrl || record.finalUrl;
      queries.push(sql`
        INSERT INTO data_sources (
          id, name, organization_id, level, source_category, source_type, collection_method,
          source_url, source_domain, list_page_url, crawler_strategy, discovery_status,
          automation_allowed, requires_manual_review, status, check_frequency, normal_frequency,
          active_frequency, pool_category, pool_source_type, pool_official_status, pool_website_name,
          pool_url, pool_normalized_url, pool_source_fingerprint, pool_first_discovered_at,
          pool_last_verified_at, pool_discovery_method, pool_discovered_from_url, pool_status, pool_notes,
          last_verified_at, official_url_status
        ) VALUES (
          ${sourceId}, ${`${record.name}｜${record.pageTitle || record.poolSourceType}`}, ${organizationId}, 'A级', ${record.sourceCategory}, ${record.sourceTypeLabel}, 'HTML页面',
          ${website}, ${website ? sourceDomain(website) : null}, ${website}, 'PLAYWRIGHT_SOURCE_DISCOVERY', 'VERIFIED',
          false, true, 'active', 'manual', 'EVERY_7_DAYS', 'DAILY', ${record.poolCategory}, ${record.poolSourceType}, ${record.officialStatus}, ${record.pageTitle || record.name},
          ${website}, ${record.normalizedUrl}, ${record.sourceFingerprint}, ${asTimestamp(record.verifiedAt)},
          ${asTimestamp(record.verifiedAt)}, 'playwright_verified_import', ${record.discoveredFromUrl}, 'active', ${record.error || null},
          ${asTimestamp(record.verifiedAt)}, 'UNREGISTERED'
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }
  }

  if (queries.length > 0) await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
  const after = await countRows(sql);
  console.log(JSON.stringify({ ...summary, before, after, inserted: { organizations: newOrganizations, sources: newSources }, updated: { organizations: updatedOrganizations, sources: updatedSources }, dataPreserved: true }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
