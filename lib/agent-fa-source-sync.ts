import { neon } from "@neondatabase/serverless";
import { getAgentFaBootstrapRecords } from "../db/seeds/agent-fa-source-pool";

type SqlClient = ReturnType<typeof neon>;

const AGENT_FA_SOURCE_POOL_URL = "https://raw.githubusercontent.com/JB54088/Agent-fa/main/exports/source_pool.json";
const SOURCE_DIRECTORY_MARKER = "[source-directory-sync:v1]";
const AGENT_FA_MARKER = "[agent-fa-sync:v1]";

type AgentFaRecord = {
  organization_name?: unknown;
  category?: unknown;
  source_type?: unknown;
  official_status?: unknown;
  website_name?: unknown;
  url?: unknown;
  normalized_url?: unknown;
  province?: unknown;
  city?: unknown;
  parent_organization?: unknown;
  first_discovered_at?: unknown;
  last_verified_at?: unknown;
  discovery_method?: unknown;
  discovered_from_url?: unknown;
  status?: unknown;
};

type AgentFaPayload = { rows?: AgentFaRecord[] };

export type AgentFaSyncSummary = {
  repository: string;
  sourceRecords: number;
  validRecords: number;
  insertedOrganizations: number;
  insertedSources: number;
  linkedExistingOrganizations: number;
  skippedExistingUrls: number;
  skippedExistingNames: number;
  skippedBatchDuplicates: number;
  skippedInvalidUrls: number;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s\u3000·•()（）[\]【】{}「」“”‘’'".,，。:：;；/\\|、_\-—]+/g, "")
    .replace(/(有限责任公司|股份有限公司|有限公司|集团有限公司|集团|公司)$/g, "");
}

function normalizeUrl(value: string) {
  const parsed = new URL(value);
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) parsed.port = "";
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|spm|source|from|ref|channel|campaign|click|trace|session)/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString();
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

function sourceCategory(category: string) {
  return ({
    big_company: "ENTERPRISE",
    central_soe: "CENTRAL_SOE",
    local_soe: "LOCAL_SOE",
    national_civil_service: "NATIONAL_CIVIL_SERVICE",
    provincial_civil_service: "PROVINCIAL_CIVIL_SERVICE",
    military_civilian: "OTHER_OFFICIAL",
  } as Record<string, string>)[category] ?? "ENTERPRISE_DISCOVERY";
}

function sourceType(sourceTypeValue: string) {
  if (sourceTypeValue === "exam_site" || sourceTypeValue === "government_site") return "政府官网";
  if (sourceTypeValue === "official_recruitment_page") return "招聘官网";
  return "企业官网";
}

function organizationType(category: string) {
  return ({
    big_company: "知名企业",
    central_soe: "央企",
    local_soe: "地方国企",
    national_civil_service: "公务员招录",
    provincial_civil_service: "公务员招录",
    military_civilian: "军队文职",
  } as Record<string, string>)[category] ?? "官方来源";
}

function industry(category: string) {
  return ({
    big_company: "重点企业",
    central_soe: "能源、制造与基础设施",
    local_soe: "地方国企",
    national_civil_service: "公共管理",
    provincial_civil_service: "公共管理",
    military_civilian: "军队文职",
  } as Record<string, string>)[category] ?? "招聘信息服务";
}

function priority(category: string) {
  return ["central_soe", "national_civil_service", "provincial_civil_service"].includes(category) ? "P0" : "P1";
}

async function readAgentFaRecords() {
  try {
    const response = await fetch(AGENT_FA_SOURCE_POOL_URL, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as AgentFaPayload;
    const records = Array.isArray(payload.rows) ? payload.rows : [];
    if (records.length) return records;
  } catch {
    // Production can temporarily have no outbound access to raw.githubusercontent.com.
    // The deployed site carries the last checked-in 141-row snapshot for a safe retry.
  }
  return await getAgentFaBootstrapRecords() as AgentFaRecord[];
}

async function ensurePoolColumns(sql: SqlClient) {
  await Promise.all([
    sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pool_normalized_name text`,
    sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pool_category text`,
    sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pool_official_status text`,
    sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pool_first_discovered_at timestamptz`,
    sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pool_last_verified_at timestamptz`,
    sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pool_discovery_method text`,
    sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pool_discovered_from_url text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_category text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_source_type text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_official_status text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_website_name text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_url text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_normalized_url text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_source_fingerprint text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_first_discovered_at timestamptz`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_last_verified_at timestamptz`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_discovery_method text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_discovered_from_url text`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_status text NOT NULL DEFAULT 'active'`,
    sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pool_notes text`,
  ]);
}

export async function syncAgentFaSources(sql: SqlClient): Promise<AgentFaSyncSummary> {
  await ensurePoolColumns(sql);
  const rawRecords = await readAgentFaRecords();
  const organizations = await sql`SELECT id::text AS id, name, short_name FROM organizations`;
  const sources = await sql`SELECT id::text AS id, organization_id::text AS organization_id, name, source_url, list_page_url, pool_normalized_url, pool_source_fingerprint FROM data_sources`;
  const orgByName = new Map<string, string>();
  for (const row of organizations) {
    const name = text(row.name);
    const shortName = text(row.short_name);
    if (name) orgByName.set(normalizeName(name), String(row.id));
    if (shortName) orgByName.set(normalizeName(shortName), String(row.id));
  }
  const sourceUrls = new Set<string>();
  const sourceNames = new Set<string>();
  const sourceFingerprints = new Set<string>();
  for (const row of sources) {
    for (const value of [row.source_url, row.list_page_url, row.pool_normalized_url]) {
      const url = text(value);
      if (url) {
        try { sourceUrls.add(normalizeUrl(url)); } catch { /* ignore malformed legacy URLs */ }
      }
    }
    const orgId = text(row.organization_id);
    const name = normalizeName(text(row.name));
    if (orgId && name) sourceNames.add(`${orgId}:${name}`);
    if (text(row.pool_source_fingerprint)) sourceFingerprints.add(text(row.pool_source_fingerprint));
  }

  const summary: AgentFaSyncSummary = {
    repository: AGENT_FA_SOURCE_POOL_URL,
    sourceRecords: rawRecords.length,
    validRecords: 0,
    insertedOrganizations: 0,
    insertedSources: 0,
    linkedExistingOrganizations: 0,
    skippedExistingUrls: 0,
    skippedExistingNames: 0,
    skippedBatchDuplicates: 0,
    skippedInvalidUrls: 0,
  };
  const queries: Array<ReturnType<SqlClient>> = [];
  const pendingOrgIds = new Map<string, string>();
  const seenBatchUrls = new Set<string>();
  const seenBatchNames = new Set<string>();

  for (const record of rawRecords) {
    const organizationName = text(record.organization_name);
    const websiteName = text(record.website_name) || organizationName;
    const rawUrl = text(record.url);
    const category = text(record.category);
    if (!organizationName || !websiteName || !rawUrl) { summary.skippedInvalidUrls += 1; continue; }
    let normalizedUrl: string;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("unsupported_protocol");
      normalizedUrl = normalizeUrl(rawUrl);
    } catch {
      summary.skippedInvalidUrls += 1;
      continue;
    }
    summary.validRecords += 1;
    const orgKey = normalizeName(organizationName);
    const batchKey = `${orgKey}:${normalizedUrl}`;
    const nameKey = `${orgKey}:${normalizeName(websiteName)}`;
    if (seenBatchUrls.has(batchKey) || seenBatchNames.has(nameKey)) { summary.skippedBatchDuplicates += 1; continue; }
    seenBatchUrls.add(batchKey);
    seenBatchNames.add(nameKey);
    if (sourceUrls.has(normalizedUrl)) { summary.skippedExistingUrls += 1; continue; }

    let organizationId = orgByName.get(orgKey) ?? pendingOrgIds.get(orgKey);
    if (organizationId) {
      summary.linkedExistingOrganizations += 1;
    } else {
      organizationId = await stableUuid(`agent-fa:organization:${orgKey}`);
      pendingOrgIds.set(orgKey, organizationId);
      orgByName.set(orgKey, organizationId);
      queries.push(sql`
        INSERT INTO organizations (
          id, name, short_name, organization_type, industry, priority, status,
          pool_normalized_name, pool_category, pool_official_status,
          pool_first_discovered_at, pool_last_verified_at, pool_discovery_method,
          pool_discovered_from_url
        ) VALUES (
          ${organizationId}, ${organizationName}, ${organizationName}, ${organizationType(category)},
          ${industry(category)}, ${priority(category)}, 'active', ${orgKey}, ${category},
          ${text(record.official_status) || "official"}, ${text(record.first_discovered_at) || null},
          ${text(record.last_verified_at) || null}, ${text(record.discovery_method) || "agent_fa_source_pool"},
          ${text(record.discovered_from_url) || rawUrl}
        )
        ON CONFLICT (id) DO NOTHING
      `);
      summary.insertedOrganizations += 1;
    }

    const fingerprint = await digestHex(`agent-fa:${normalizedUrl}`);
    if (sourceFingerprints.has(fingerprint)) { summary.skippedExistingUrls += 1; continue; }
    const sourceNameKey = `${organizationId}:${normalizeName(websiteName)}`;
    if (sourceNames.has(sourceNameKey)) { summary.skippedExistingNames += 1; continue; }
    sourceUrls.add(normalizedUrl);
    sourceNames.add(sourceNameKey);
    sourceFingerprints.add(fingerprint);
    const sourceId = await stableUuid(`agent-fa:source:${fingerprint}`);
    const note = `来自 GitHub Agent-fa source_pool.json；仓库记录标记为官方来源，本站仍需人工打开、登记官方URL并确认发布。${SOURCE_DIRECTORY_MARKER} ${AGENT_FA_MARKER}`;
    queries.push(sql`
      INSERT INTO data_sources (
        id, name, organization_id, level, source_category, source_type, collection_method,
        source_url, source_domain, crawler_strategy, list_page_url,
        discovery_status, automation_allowed, requires_manual_review,
        check_frequency, normal_frequency, active_frequency, status, admin_note,
        recruitment_link_status, official_url_status,
        pool_category, pool_source_type, pool_official_status, pool_website_name,
        pool_url, pool_normalized_url, pool_source_fingerprint,
        pool_first_discovered_at, pool_last_verified_at, pool_discovery_method,
        pool_discovered_from_url, pool_status, pool_notes
      ) VALUES (
        ${sourceId}, ${websiteName}, ${organizationId}, 'A级', ${sourceCategory(category)},
        ${sourceType(text(record.source_type))}, '人工录入', ${rawUrl}, ${parsedUrl.hostname},
        'MANUAL_SOURCE_AUDIT', ${rawUrl}, 'NEEDS_REVIEW', false, true, 'MANUAL',
        'EVERY_7_DAYS', 'DAILY', 'active', ${note}, 'NEEDS_REVIEW', 'UNREGISTERED',
        ${category || "unknown"}, ${text(record.source_type) || "official_homepage"},
        ${text(record.official_status) || "official"}, ${websiteName}, ${rawUrl},
        ${normalizedUrl}, ${fingerprint}, ${text(record.first_discovered_at) || null},
        ${text(record.last_verified_at) || null}, ${text(record.discovery_method) || "agent_fa_source_pool"},
        ${text(record.discovered_from_url) || rawUrl}, 'active',
        '导入后只作为候选来源，禁止自动发布招聘信息。'
      )
      ON CONFLICT (id) DO NOTHING
    `);
    summary.insertedSources += 1;
  }

  if (queries.length) await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
  return summary;
}
