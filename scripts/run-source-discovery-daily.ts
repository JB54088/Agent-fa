import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { exploreWithPlaywright, searchWithPlaywright, type DiscoveryQuerySeed, type DiscoverySeed } from "../lib/source-discovery/index.ts";
import { discoveryQueueFingerprint } from "../lib/source-discovery/queue.ts";
import { readSourcePoolRecords } from "../lib/source-pool/import-plan.ts";
import { normalizeSourcePoolRecord, normalizeUrl } from "../lib/source-pool/normalize.ts";
import type { SourcePoolCategory } from "../lib/source-pool/types.ts";

type Config = { discovery: { max_new_candidates_per_day: number; max_verifications_per_day: number; max_browser_pages: number; timeout_ms: number; default_verification_interval_days: number; playwright_module: string } };

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadConfig(projectRoot: string): Promise<Config> {
  return JSON.parse(await readFile(resolve(projectRoot, "config/source-discovery.json"), "utf8")) as Config;
}

async function loadSeedsFromFiles(projectRoot: string, limit: number): Promise<DiscoverySeed[]> {
  const records = await readSourcePoolRecords(projectRoot);
  return records.slice(0, limit).map((record) => {
    const normalized = normalizeSourcePoolRecord(record);
    return {
      organizationName: normalized.name,
      category: normalized.poolCategory,
      province: normalized.region,
      url: normalized.website || normalized.listedUrl || normalized.finalUrl || "",
      parentOrganizationName: null,
    };
  }).filter((seed) => seed.url);
}

async function loadSeedsFromDatabase(sql: ReturnType<typeof neon>, limit: number, verificationIntervalDays: number, forceFrontier: boolean): Promise<DiscoverySeed[]> {
  const sourceRows = await sql`
    SELECT o.name AS organization_name, ds.pool_category AS category, r.name AS province,
      COALESCE(ds.pool_url, ds.source_url) AS url
    FROM data_sources ds
    JOIN organizations o ON o.id = ds.organization_id
    LEFT JOIN regions r ON r.id = o.region_id
    WHERE ds.pool_status = 'active'
      AND COALESCE(ds.pool_url, ds.source_url) IS NOT NULL
      AND (${forceFrontier} OR ds.pool_last_verified_at IS NULL OR ds.pool_last_verified_at <= now() - (${verificationIntervalDays} * interval '1 day'))
    ORDER BY CASE WHEN ds.pool_last_verified_at IS NULL THEN 0 ELSE 1 END, ds.pool_category, o.name
    LIMIT ${limit}
  ` as unknown as Array<Record<string, unknown>>;
  const queueRows = await sql`
    SELECT name AS organization_name, possible_category AS category, province, candidate_url AS url
    FROM discovery_queue
    WHERE status = 'pending' AND candidate_url IS NOT NULL
    ORDER BY priority ASC, discovered_at ASC
    LIMIT ${limit}
  ` as unknown as Array<Record<string, unknown>>;
  const seeds = [...sourceRows, ...queueRows].map((row) => ({
    organizationName: String(row.organization_name),
    category: (row.category || "big_company") as SourcePoolCategory,
    province: row.province ? String(row.province) : null,
    url: String(row.url),
    parentOrganizationName: null,
  }));
  return [...new Map(seeds.map((seed) => [normalizeUrl(seed.url), seed])).values()].slice(0, limit);
}

async function loadQueriesFromDatabase(sql: ReturnType<typeof neon>, limit: number): Promise<DiscoveryQuerySeed[]> {
  const rows = await sql`
    SELECT query, category, NULLIF(province, '') AS province, strategy, priority
    FROM discovery_queries
    ORDER BY priority ASC, zero_result_streak ASC, last_run_at NULLS FIRST
    LIMIT ${limit}
  ` as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    query: String(row.query),
    category: String(row.category) as DiscoveryQuerySeed["category"],
    province: row.province ? String(row.province) : null,
    strategy: String(row.strategy),
    priority: Number(row.priority ?? 50),
  }));
}

async function persistCandidates(sql: ReturnType<typeof neon>, candidates: Awaited<ReturnType<typeof exploreWithPlaywright>>["candidates"]) {
  const before = await sql`SELECT count(*)::int AS count FROM discovery_queue`;
  const queries = candidates.map((candidate) => sql`
    INSERT INTO discovery_queue (
      id, name, normalized_name, organization_fingerprint, possible_category,
      parent_organization_name, province, city, discovered_from, discovered_from_url,
      candidate_url, candidate_normalized_url, queue_fingerprint, priority, status, notes
    ) VALUES (
      ${randomUUID()}, ${candidate.name}, ${candidate.name.normalize("NFKC")}, NULL, ${candidate.possibleCategory},
      ${candidate.parentOrganizationName}, ${candidate.province}, ${candidate.city}, ${candidate.discoveredFrom}, ${candidate.discoveredFromUrl},
      ${candidate.candidateUrl}, ${normalizeUrl(candidate.candidateUrl)}, ${discoveryQueueFingerprint(candidate)}, ${candidate.priority}, 'pending', ${candidate.notes}
    ) ON CONFLICT (queue_fingerprint) DO NOTHING
  `);
  if (queries.length > 0) await sql.transaction(queries, { isolationLevel: "ReadCommitted" });
  const after = await sql`SELECT count(*)::int AS count FROM discovery_queue`;
  return { before: Number(before[0]?.count ?? 0), after: Number(after[0]?.count ?? 0), added: Number(after[0]?.count ?? 0) - Number(before[0]?.count ?? 0) };
}

async function writeReport(projectRoot: string, result: { pagesVisited: number; candidates: Awaited<ReturnType<typeof exploreWithPlaywright>>["candidates"]; failures: Awaited<ReturnType<typeof exploreWithPlaywright>>["failures"]; queueAdded: number }) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const reportDir = resolve(projectRoot, "reports/discovery");
  await mkdir(reportDir, { recursive: true });
  const categories = result.candidates.reduce<Record<string, number>>((counts, candidate) => {
    counts[candidate.possibleCategory] = (counts[candidate.possibleCategory] ?? 0) + 1;
    return counts;
  }, {});
  const lines = [
    `# ${date} 信息源发现报告`,
    "",
    `- 今日访问探索页面：${result.pagesVisited}`,
    `- 今日发现候选：${result.candidates.length}`,
    `- 加入 Discovery Queue：${result.queueAdded}`,
    `- 访问失败：${result.failures.length}`,
    `- 分类分布：${JSON.stringify(categories)}`,
    "",
    "## 今日新增候选",
    "",
    ...result.candidates.map((candidate) => `- ${candidate.name}｜${candidate.possibleCategory}｜${candidate.candidateUrl}｜发现自：${candidate.discoveredFromUrl}`),
    "",
    "## 失败页面",
    "",
    ...result.failures.map((failure) => `- ${failure.seed.organizationName}｜${failure.seed.url}｜${failure.error}`),
    "",
    "候选进入队列后仍需继续验证，未自动绕过证书、登录、验证码或安全检查。",
    "",
  ];
  const reportPath = resolve(reportDir, `${date}.md`);
  await writeFile(reportPath, lines.join("\n"), "utf8");
  return reportPath;
}

async function main() {
  const projectRoot = resolve(process.cwd());
  const config = await loadConfig(projectRoot);
  const dryRun = process.argv.includes("--dry-run");
  const seedUrl = argValue("--seed-url");
  const databaseUrl = process.env.DATABASE_URL;
  const forceFrontier = process.argv.includes("--force-frontier");
  let sql: ReturnType<typeof neon> | null = null;
  let runId: string | null = null;
  if (!dryRun) {
    if (!databaseUrl) throw new Error("DATABASE_URL is required unless --dry-run is used.");
    sql = neon(databaseUrl);
    const runRows = await sql`INSERT INTO discovery_runs (trigger_type, max_new_candidates, max_verifications, max_browser_pages) VALUES ('scheduled', ${config.discovery.max_new_candidates_per_day}, ${config.discovery.max_verifications_per_day}, ${config.discovery.max_browser_pages}) RETURNING id`;
    runId = String((runRows as any)[0]?.id);
  }
  const seeds = seedUrl
    ? [{ organizationName: argValue("--organization") || "待识别机构", category: (argValue("--category") || "big_company") as SourcePoolCategory, province: argValue("--province") || null, url: seedUrl, parentOrganizationName: null }]
    : sql
      ? await loadSeedsFromDatabase(sql, config.discovery.max_browser_pages, config.discovery.default_verification_interval_days, forceFrontier)
      : process.argv.includes("--from-files")
        ? await loadSeedsFromFiles(projectRoot, config.discovery.max_browser_pages)
        : [];
  const querySeeds = sql && !process.argv.includes("--no-search") ? await loadQueriesFromDatabase(sql, Math.min(10, config.discovery.max_browser_pages)) : [];
  if (seeds.length === 0 && querySeeds.length === 0) {
    const reportPath = await writeReport(projectRoot, { pagesVisited: 0, candidates: [], failures: [], queueAdded: 0 });
    console.log(JSON.stringify({ dryRun, pagesVisited: 0, candidates: 0, failures: 0, queueAdded: 0, reportPath, note: "没有到达验证间隔的旧来源，也没有待处理队列；本次不重复访问旧站点。" }, null, 2));
    return;
  }
  let result;
  try {
    const playwrightModule = process.env.PLAYWRIGHT_MODULE || config.discovery.playwright_module;
    const searchResult = querySeeds.length > 0 ? await searchWithPlaywright(querySeeds, {
      budget: {
        maxNewCandidatesPerDay: config.discovery.max_new_candidates_per_day,
        maxVerificationsPerDay: config.discovery.max_verifications_per_day,
        maxBrowserPages: Math.min(10, config.discovery.max_browser_pages),
        timeoutMs: config.discovery.timeout_ms,
      },
      playwrightModule,
    }) : { candidates: [], failures: [], pagesVisited: 0 };
    const remainingPages = Math.max(0, config.discovery.max_browser_pages - searchResult.pagesVisited);
    const exploreResult = seeds.length > 0 && remainingPages > 0 ? await exploreWithPlaywright(seeds, {
      budget: {
        maxNewCandidatesPerDay: Math.max(0, config.discovery.max_new_candidates_per_day - searchResult.candidates.length),
        maxVerificationsPerDay: config.discovery.max_verifications_per_day,
        maxBrowserPages: remainingPages,
        timeoutMs: config.discovery.timeout_ms,
      },
      playwrightModule,
    }) : { candidates: [], failures: [], pagesVisited: 0 };
    result = {
      candidates: [...searchResult.candidates, ...exploreResult.candidates].slice(0, config.discovery.max_new_candidates_per_day),
      failures: [...searchResult.failures, ...exploreResult.failures],
      pagesVisited: searchResult.pagesVisited + exploreResult.pagesVisited,
    };
    if (sql && querySeeds.length > 0) {
      const queryUpdates = querySeeds.map((query) => sql`
        UPDATE discovery_queries
        SET last_run_at = now(), result_count = ${result.candidates.filter((candidate) => candidate.notes.includes(query.strategy)).length},
            zero_result_streak = CASE WHEN ${result.candidates.some((candidate) => candidate.notes.includes(query.strategy))} THEN 0 ELSE zero_result_streak + 1 END,
            updated_at = now()
        WHERE query = ${query.query} AND category = ${query.category} AND province = ${query.province || ""}
      `);
      await sql.transaction(queryUpdates, { isolationLevel: "ReadCommitted" });
    }
  } catch (error) {
    if (sql && runId) await sql`UPDATE discovery_runs SET status = 'FAILED', finished_at = now(), failed_count = 1, error_message = ${error instanceof Error ? error.message : String(error)}, updated_at = now() WHERE id = ${runId}`;
    throw error;
  }
  let queueAdded = 0;
  if (sql) {
    const persisted = await persistCandidates(sql, result.candidates);
    queueAdded = persisted.added;
    if (runId) await sql`UPDATE discovery_runs SET status = ${result.failures.length > 0 ? "PARTIAL_SUCCESS" : "SUCCESS"}, finished_at = now(), candidates_found = ${result.candidates.length}, queue_added = ${queueAdded}, failed_count = ${result.failures.length}, report_path = ${resolve(projectRoot, "reports/discovery")}, updated_at = now() WHERE id = ${runId}`;
  }
  const reportPath = await writeReport(projectRoot, { ...result, queueAdded });
  console.log(JSON.stringify({ dryRun, pagesVisited: result.pagesVisited, candidates: result.candidates.length, failures: result.failures.length, queueAdded, reportPath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
