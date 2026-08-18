# 中国招聘/招考信息源池 Agent

这是在现有 TypeScript + Drizzle/PostgreSQL 项目内新增的长期 Source Pool 层，不是另一个项目，也不覆盖原有招聘数据。

## 当前盘点

Playwright 已核验目录：

- `docs/data-sources/verified-official-opportunity-sites.json`
- 138 条原有可访问来源，19 条排除项。
- 增量文件 `docs/data-sources/verified-source-pool-additions.json` 追加了中国石油官网发现并实际打开核验的 3 个独立招聘入口。
- 当前导入计划：141 条来源、138 家机构，输入文件内重复 0 条。

原有的 100 家单位台账、全国来源目录、38 条全国采集日志和既有 TypeScript/Drizzle 表均保留。

## 数据模型

正式 Source Pool 复用已有表：

- `organizations`：机构主体和不可覆盖的首次发现时间。
- `data_sources`：同一机构的多个官网、招聘官网、校园招聘、社会招聘等 URL。

新增池专用字段使用 `pool_` 前缀，避免改变既有业务字段语义。关键字段包括：

- `pool_category`
- `pool_source_type`
- `pool_official_status`
- `pool_normalized_url`
- `pool_source_fingerprint`
- `pool_first_discovered_at`
- `pool_last_verified_at`
- `pool_verification_interval_days`
- `pool_discovery_method`
- `pool_discovered_from_url`

新增长期表：

- `discovery_queue`：候选机构/候选入口，状态为 `pending`、`processing`、`verified`、`rejected`、`failed`。
- `discovery_runs`：每日运行、预算、候选数、入队数、失败数和报告路径。
- `discovery_queries`：查询策略、优先级、最近执行时间、结果数和连续零结果次数。
- `organization_relations`：集团、成员单位、研究院、分公司、控股公司等关系。

同一机构可以有多个 source。机构指纹和 source 指纹分别去重；URL 规范化会处理 `http/https`、`www`、尾部 `/`、fragment、常见跟踪参数和会话参数。`pool_first_discovered_at` 只在首次导入时写入，后续只更新 `pool_last_verified_at`。

## 数据库迁移与增量导入

先检查迁移，不会写库：

```bash
node --experimental-strip-types scripts/migrate-source-pool.ts --dry-run
```

配置 PostgreSQL 后执行安全迁移：

```bash
export DATABASE_URL='postgresql://...'
node --experimental-strip-types scripts/migrate-source-pool.ts
```

迁移文件为 `drizzle/0013_source_pool_agent.sql`，只使用 `IF NOT EXISTS`，不会删除表、删除数据或重建数据库。

先做无写入导入检查：

```bash
node --experimental-strip-types scripts/inspect-source-pool.ts
node --experimental-strip-types scripts/import-source-pool.ts --dry-run
```

确认数据库迁移完成后，再增量导入：

```bash
node --experimental-strip-types scripts/import-source-pool.ts
node --experimental-strip-types scripts/seed-discovery-queries.ts
```

导入器会与已有机构和来源按名称、机构指纹、来源指纹和规范化 URL 合并；已存在的记录不重新插入，不删除旧记录，不覆盖首次发现时间。当前环境没有配置 `DATABASE_URL`，所以本轮只完成了迁移校验和无写入导入校验，没有伪造数据库写入成功。

## Playwright 增量发现

发现器分两条路径：

1. 从已登记且达到 `pool_verification_interval_days` 的官方来源页面探索招聘、人才、职业、成员单位、组织机构、子公司、研究院等链接。
2. 从 `discovery_queries` 取优先级高且较久未运行的查询，通过 Playwright 搜索；搜索结果只能进入 `discovery_queue`，不能直接成为正式来源。

候选必须进入队列并继续验证。代码不会绕过证书错误、登录、验证码、访问控制或安全检查，也不会把搜索结果页当作最终来源。

手动指定一个官方种子进行一次探索：

```bash
PLAYWRIGHT_MODULE=playwright \
node --experimental-strip-types scripts/run-source-discovery-daily.ts \
  --seed-url https://www.cnpc.com.cn/cnpc/index.shtml \
  --organization 中国石油天然气集团有限公司 \
  --category central_soe \
  --dry-run
```

正式每日运行需要数据库、已安装的 Node Playwright 包和已执行迁移：

```bash
node --experimental-strip-types scripts/run-source-discovery-daily.ts
```

默认不会每天重新访问全部旧来源；只处理待验证间隔到期的来源、待处理队列和 `discovery_queries`。确需人工扩大探索范围时才使用 `--force-frontier`。

## 每日报告与自动运行

报告写入：

```text
reports/discovery/YYYY-MM-DD.md
```

报告只列当天候选、入队数量和失败页面，不重复输出完整历史池。

北京时间每天 07:00 的 cron 示例：

```cron
CRON_TZ=Asia/Shanghai
0 7 * * * cd /absolute/path/to/2026.7.24 && /absolute/path/to/node --experimental-strip-types scripts/run-source-discovery-daily.ts >> logs/source-discovery-cron.log 2>&1
```

数据库必须使用持久化 PostgreSQL；不要把生产 Source Pool 放在 GitHub Actions 临时磁盘中。若使用 GitHub Actions，应把 `DATABASE_URL` 放在 repository secret，并让 workflow 只负责调用 Agent，数据始终写入 PostgreSQL。

### GitHub Actions 自动收录

仓库已提供 `.github/workflows/source-pool-daily.yml`，默认每天北京时间 07:00 运行，也可以在 Actions 页面手动触发。每次运行会依次：

1. 安装 Node.js、Playwright 和 Chromium；
2. 幂等应用 Source Pool 迁移；
3. 将 Git 中已核验来源增量导入 PostgreSQL；
4. 执行 Playwright 官网内部链接探索和搜索结果入队；
5. 导出 `exports/source_pool.csv`、`exports/source_pool.json`、`exports/source_pool.xlsx`；
6. 将当日 `reports/discovery/YYYY-MM-DD.md` 与导出文件自动提交回 `main`。

启用前请在仓库 `Settings → Secrets and variables → Actions` 中添加：

```text
DATABASE_URL=生产 PostgreSQL 连接串
```

GitHub Actions 只把已核验 Source Pool 导出和每日发现报告写回 Git；未验证的候选仍保留在 PostgreSQL 的 `discovery_queue` 中，不会自动冒充正式来源。

## 导出与查询

```bash
node --experimental-strip-types scripts/export-source-pool.ts
node --experimental-strip-types scripts/query-source-pool.ts --category central_soe
node --experimental-strip-types scripts/query-source-pool.ts --province 广东
node --experimental-strip-types scripts/query-source-pool.ts --name 中国移动
```

导出文件：

- `exports/source_pool.csv`
- `exports/source_pool.json`
- `exports/source_pool.xlsx`

## 当前边界

当前完成的是 P0 的池持久化、增量导入、稳定去重、Discovery Queue、预算配置、Playwright 探索适配器、查询策略和导出入口。具体招聘公告/岗位抓取不在当前 Source Pool 优先级内；后续公告采集应复用这个池，不重新构建网站名单。
