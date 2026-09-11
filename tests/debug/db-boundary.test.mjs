/**
 * 调试用例：数据库边界与环境门控。
 *
 * 关注两件事：
 *   1. db/index.ts 里 `NEON_LOCAL_ENDPOINT` 对 Neon 驱动全局端点的覆盖行为（当前无环境保护）。
 *   2. 各路由用 `error.message.includes("not configured")` 判定"服务未连接"的契约——
 *      这条契约是否仍然成立。
 *
 * 说明：本文件不连接任何数据库。`getDatabaseUrl()` 的失败路径只读取环境变量，不会发起网络请求。
 * 通过 import 上的查询串让 db/index.ts 在每个用例里重新求值，从而隔离模块级副作用。
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { neonConfig } = await import("@neondatabase/serverless");
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

/** 驱动默认端点。Neon 驱动把它作为模块级全局保存，所以必须在任何导入之前抓取。 */
const baselineFetchEndpoint = neonConfig.fetchEndpoint;

let importCounter = 0;
const freshDbModule = () => import(new URL(`../../db/index.ts?debug=${++importCounter}`, import.meta.url).href);

/** 在指定的环境变量下执行，结束后恢复现场（含驱动全局端点，避免用例互相污染）。 */
async function withEnv(vars, run) {
  const saved = Object.entries(vars).map(([key]) => [key, process.env[key]]);
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    neonConfig.fetchEndpoint = baselineFetchEndpoint;
  }
}

/** 收集本仓库里所有按 "not configured" 判定"未连接"的路由文件。 */
const NOT_CONFIGURED_ROUTES = [
  "app/api/reminders/route.ts",
  "app/api/favorites/[opportunityId]/route.ts",
  "app/api/notifications/route.ts",
  "app/api/notifications/[notificationId]/route.ts",
  "app/api/cron/recruitment-deadline-reminders/route.ts",
];

test("未设置 NEON_LOCAL_ENDPOINT 时，不得改写 Neon 驱动的全局端点", async () => {
  await withEnv({ NEON_LOCAL_ENDPOINT: undefined }, async () => {
    await freshDbModule();
    assert.equal(neonConfig.fetchEndpoint, baselineFetchEndpoint, "导入 db/index.ts 就改动了全局端点");
  });
});

test("设置 NEON_LOCAL_ENDPOINT 时按配置覆盖端点（本地开发路径生效）", async () => {
  const localEndpoint = "http://127.0.0.1:4444/sql";
  await withEnv({ NEON_LOCAL_ENDPOINT: localEndpoint }, async () => {
    await freshDbModule();
    assert.equal(neonConfig.fetchEndpoint, localEndpoint);
  });
});

test("生产环境不得被本地代理端点覆盖：覆盖必须带 NODE_ENV 保护", async () => {
  await withEnv({ NODE_ENV: "production", NEON_LOCAL_ENDPOINT: "http://127.0.0.1:4444/sql" }, async () => {
    await freshDbModule();
    assert.equal(
      neonConfig.fetchEndpoint,
      baselineFetchEndpoint,
      "NODE_ENV=production 时 NEON_LOCAL_ENDPOINT 仍然改写了全局端点：如果该变量被误带到部署环境，全进程数据库流量会被重定向到明文 HTTP 的本地桥接",
    );
  });
});

test("缺少 DATABASE_URL 时，抛出的错误信息必须能被路由的 503 判定子串命中", async () => {
  await withEnv({ DATABASE_URL: undefined, NEON_LOCAL_ENDPOINT: undefined }, async () => {
    const db = await freshDbModule();

    let message = "";
    try {
      db.getDatabaseUrl();
    } catch (error) {
      message = error.message;
    }

    assert.ok(message.length > 0, "缺少 DATABASE_URL 时 getDatabaseUrl() 应当抛错");
    assert.ok(
      message.includes("not configured"),
      `路由用 includes("not configured") 判定"服务未连接"，但实际抛出的是：${message}`,
    );
  });
});

test("全部 5 个 'not configured' 判定点都必须与真实错误信息匹配（否则 503 分支是死代码）", async () => {
  const realMessage = await withEnv({ DATABASE_URL: undefined, NEON_LOCAL_ENDPOINT: undefined }, async () => {
    const db = await freshDbModule();
    try {
      db.getDatabaseUrl();
    } catch (error) {
      return error.message;
    }
    throw new Error("缺少 DATABASE_URL 时 getDatabaseUrl() 应当抛错");
  });

  const mismatches = [];
  for (const relativePath of NOT_CONFIGURED_ROUTES) {
    const source = await readFile(path.join(projectRoot, relativePath), "utf8");
    const substrings = [...source.matchAll(/includes\(\s*"([^"]*)"\s*\)/g)].map((item) => item[1]);
    if (submatchesToCheck(substrings, realMessage).length === 0) {
      mismatches.push(`${relativePath}: 检查 ${JSON.stringify(substrings)}，均无法命中真实信息「${realMessage}」→ 503 分支不可达`);
    }
  }

  assert.deepEqual(mismatches, [], `以下判定点与真实错误信息不匹配：\n${mismatches.join("\n")}`);
});

test("NEON_LOCAL_ENDPOINT 必须记录在 .env.example 中（当前仅存在于未跟踪的 .env）", async () => {
  const example = await readFile(path.join(projectRoot, ".env.example"), "utf8");
  assert.ok(
    example.includes("NEON_LOCAL_ENDPOINT"),
    "db/index.ts 会读取 NEON_LOCAL_ENDPOINT，但 .env.example 未记录该变量，其他开发者无法得知本地桥接的存在",
  );
});

function submatchesToCheck(substrings, realMessage) {
  return substrings.filter((substring) => realMessage.includes(substring));
}
