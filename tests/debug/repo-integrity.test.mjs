/**
 * 调试用例：仓库级一致性。
 *
 * 这些不是业务逻辑测试，而是"这个仓库现在的状态是否自洽"的断言——迁移清单、来源池计数、
 * 环境变量文档、死代码。全部只读文件系统，不连数据库、不打网络。
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { buildSourcePoolImportPlan } = await import("../../lib/source-pool/import-plan.ts");
const { getAgentFaBootstrapRecords } = await import("../../db/seeds/agent-fa-source-pool.ts");

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

const SOURCE_DIRECTORIES = ["app", "lib", "db", "scripts", "worker"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".mts"];
const ENV_ALLOWLIST = new Set(["NODE_ENV"]);

async function collectSourceFiles(relativeDirectory) {
  const entries = await readdir(path.join(projectRoot, relativeDirectory), { withFileTypes: true });
  const collected = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) collected.push(...await collectSourceFiles(relativePath));
    else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) collected.push(relativePath);
  }
  return collected;
}

// ---------------------------------------------------------------------------
// 数据库迁移清单
// ---------------------------------------------------------------------------

test("drizzle：每个迁移文件都必须登记在 meta/_journal.json，否则 drizzle-kit migrate 会静默跳过", async () => {
  const journal = JSON.parse(await readFile(path.join(projectRoot, "drizzle/meta/_journal.json"), "utf8"));
  const registeredTags = new Set(journal.entries.map((entry) => entry.tag));

  const migrationTags = (await readdir(path.join(projectRoot, "drizzle")))
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort();

  assert.ok(migrationTags.length > 0, "drizzle/ 下没有迁移文件");
  const unregistered = migrationTags.filter((tag) => !registeredTags.has(tag));
  assert.deepEqual(
    unregistered,
    [],
    `以下迁移文件存在但未登记在 _journal.json，db:migrate 不会执行它们：\n${unregistered.join("\n")}`,
  );
});

test("drizzle：journal 的 idx 必须连续，不连续说明清单被编辑过", () => {
  return readFile(path.join(projectRoot, "drizzle/meta/_journal.json"), "utf8").then((raw) => {
    const indexes = JSON.parse(raw).entries.map((entry) => entry.idx);
    assert.deepEqual(indexes, indexes.map((_, position) => position), `journal 的 idx 序列不连续：${indexes.join(", ")}`);
  });
});

// ---------------------------------------------------------------------------
// 来源池计数
// ---------------------------------------------------------------------------

test("来源池：exports / docs 导入计划 / 内嵌兜底快照三处计数必须一致", async () => {
  const exported = JSON.parse(await readFile(path.join(projectRoot, "exports/source_pool.json"), "utf8"));
  const plan = await buildSourcePoolImportPlan(projectRoot);
  const bootstrap = await getAgentFaBootstrapRecords();

  assert.equal(exported.count, exported.rows.length, "exports/source_pool.json 的 count 与 rows.length 不一致");
  assert.equal(
    plan.records.length,
    exported.rows.length,
    `docs/data-sources 解析出 ${plan.records.length} 条，exports/source_pool.json 是 ${exported.rows.length} 条——每日发现任务已经让两者漂移`,
  );
  assert.equal(
    bootstrap.length,
    exported.rows.length,
    `db/seeds/agent-fa-source-pool.ts 内嵌兜底快照是 ${bootstrap.length} 条，exports/source_pool.json 是 ${exported.rows.length} 条——离线兜底已过期`,
  );
});

test("来源池：导出的每一行都必须有机构名与 URL，且不存在重复的「机构 + 归一化 URL」", async () => {
  const exported = JSON.parse(await readFile(path.join(projectRoot, "exports/source_pool.json"), "utf8"));

  const incomplete = exported.rows
    .map((row, index) => [index, row])
    .filter(([, row]) => !row.organization_name || !row.url)
    .map(([index]) => `第 ${index + 1} 行`);
  assert.deepEqual(incomplete, [], `以下行缺少 organization_name 或 url：${incomplete.join(", ")}`);

  const seen = new Map();
  const duplicates = [];
  for (const row of exported.rows) {
    const key = `${row.organization_name}|${row.normalized_url ?? row.url}`;
    if (seen.has(key)) duplicates.push(key);
    else seen.set(key, true);
  }
  assert.deepEqual(duplicates, [], `导出文件中存在重复来源：\n${duplicates.join("\n")}`);
});

// ---------------------------------------------------------------------------
// 环境变量文档
// ---------------------------------------------------------------------------

test("环境变量：源码读取的每个变量都必须记录在 .env.example", async () => {
  const example = await readFile(path.join(projectRoot, ".env.example"), "utf8");
  const documented = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]));

  const usage = new Map();
  for (const directory of SOURCE_DIRECTORIES) {
    for (const file of await collectSourceFiles(directory)) {
      const lines = (await readFile(path.join(projectRoot, file), "utf8")).split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const match of line.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
          if (!usage.has(match[1])) usage.set(match[1], `${file}:${index + 1}`);
        }
      });
    }
  }

  const undocumented = [...usage.entries()]
    .filter(([name]) => !documented.has(name) && !ENV_ALLOWLIST.has(name))
    .map(([name, location]) => `${name}（读取于 ${location}）`);

  assert.deepEqual(undocumented, [], `以下环境变量被代码读取但未记录在 .env.example：\n${undocumented.join("\n")}`);
});

// ---------------------------------------------------------------------------
// 死代码
// ---------------------------------------------------------------------------

test("lib/collection/retry-policy.ts 必须在生产代码中至少被引用一次，否则文档描述的重试策略并未生效", async () => {
  const definitionFile = "lib/collection/retry-policy.ts";
  const importers = [];

  for (const directory of SOURCE_DIRECTORIES) {
    for (const file of await collectSourceFiles(directory)) {
      if (file === definitionFile) continue;
      const content = await readFile(path.join(projectRoot, file), "utf8");
      if (/\bnextRetryDecision\b/.test(content)) importers.push(file);
    }
  }

  assert.ok(
    importers.length > 0,
    "nextRetryDecision 在生产代码中零引用：README 与注释描述的「超时/502 重试一次、连续 3 次失败转人工复核」策略没有被采集客户端使用，SafeSourceHttpClient 用的是另一套内联策略",
  );
});
