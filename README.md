# 校招路标

面向应届毕业生的招聘、招录与考试信息聚合及提醒平台。公开招聘信息保留官方来源、来源级别和最近核验时间，进入平台的新增数据必须经过人工审核后才可发布。

## 当前版本

- 前台正式数据现在只从 PostgreSQL + Drizzle 查询；数据库未连接时显示明确的不可用状态，不再把前端静态数组作为发布源。`shared/real-projects.ts` 仅保留为历史迁移/开发 fixture。
- 本次全国采集执行日志保存在 `logs/national-collection/2026-08-11/`；已实际联网扫描38个官方来源，未核验内容没有进入前台。
- 当前环境仍未配置 `DATABASE_URL`，`.openai/hosting.json` 的 D1 绑定为空；因此本次没有声称2条 PDD 记录已写入正式库，也没有启动第二轮全国采集。当前批次导入器会在缺少连接时失败退出。
- 新链路为 `raw_source_items → staging_opportunities → opportunities`；旧 `raw_collected_items` 会在迁移中保留并复制，核对数量后再单独清理。
- `source-access-diagnosis.csv` 记录38个来源的访问结果、空正文、超时、502、重定向、安全策略和工具错误；超时/502最多重试一次，连续3次失败后转 `NEEDS_REVIEW`。
- 已导入教育部《普通高等学校本科专业目录（2026年）》883 条本科专业。
- 已导入国务院学位委员会、教育部《研究生教育学科专业目录（2022年）》181 条研究生学科和专业学位类别。
- 目录保留版本、代码、学科门类、来源 URL 和官方通知 URL。
- 原始采集、Excel 导入、页面变化和复核任务均以人工审核为发布闸门。
- 收藏截止提醒核心已支持截止前7天、3天、1天和可选当天提醒；消息通过站内通知展示。
- 已加入全国来源目录：国考官方来源、31个省级省考档案、央企名录入口、10个重点地区地方国企档案和企业招聘专题发现入口。已核验的国考、央企名录和31个省级入口已直接录入URL并记录核验日期；未核验的地方国企与企业发现入口仍为空，自动采集数为0。
- 不绕过登录、验证码、访问限制或反爬措施。

## 目录结构

前后端分离的三层结构，根目录只保留工作区配置、文档与运行产物：

```text
frontend/     Next.js（vinext）前端工程：页面、静态资源、app/api 接口层、构建配置
backend/      Node 后端工程：数据库与迁移、采集与调度、鉴权/提醒/来源池业务能力、命令行脚本、Worker 入口
shared/       前后端共享的领域类型、品牌配置与官方专业目录数据
tests/        跨端测试（node:test）
docs/ reports/ logs/ exports/   文档与运行产物
```

两个工程共用根目录的 `node_modules` 与 `package.json` 依赖清单；命令都从仓库根执行：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | 在 `frontend/` 下运行 vinext（前端工程根即 `frontend/`） |
| `npm run lint` | 在 `frontend/` 下运行 ESLint |
| `npm run db:generate` / `npm run db:migrate` | 在 `backend/` 下运行 drizzle-kit |
| `npm run db:seed`、`npm run source-pool:*`、`npm run source-discovery:daily` | 后端脚本，工作目录固定为仓库根 |
| `npm test` | 先构建前端，再跑 `tests/` |

前端读取的环境变量放在 `frontend/.env.local`（Next.js 以工程目录为根加载）；后端脚本直接读取进程环境变量，本地可用 `node --env-file=.env backend/scripts/xxx.ts`。变量清单见根目录 `.env.example`。

## 本地运行

```bash
npm install
npm run dev
```

## 数据库初始化与当前批次导入

先将真实 PostgreSQL 连接写入未提交的 `.env` 或部署密钥，再执行：

```bash
npm run db:migrate
npm run db:import-current-batch
```

以上命令会把当前12条原始记录写入 raw/staging；两条 PDD 记录只有在明确带上 `--publish-verified-pdd` 时，才会沿用已有人工核验日志进入正式库：

```bash
npm run db:import-current-batch -- --publish-verified-pdd
```

未提供数据库连接时不会创建任何数据库记录。D级来源默认不能发布，必须有更高等级来源或数据库中的特别批准记录。

## 校验与构建

```bash
npm run validate:major-directory
npm test
npm run build
```

## 专业目录更新

官方目录原始 PDF 由运营人员下载后，执行：

```bash
python3 backend/scripts/import-official-major-directory.py \
  --undergraduate-pdf /path/to/undergraduate.pdf \
  --graduate-pdf /path/to/graduate.pdf
node backend/scripts/validate-major-directory.mjs
```

导入说明见 [shared/data/major-directory/README.md](shared/data/major-directory/README.md)。数据库迁移见 `backend/drizzle/0003_major_directory_formalization.sql`，目录版本和原始文件哈希应写入 `major_sources`、`major_directory_versions` 和 `major_import_runs`。

## 收藏截止提醒

提醒接口和每日任务位于：

- `POST/DELETE /api/favorites/:opportunityId`：收藏或取消收藏，并创建/取消未来提醒；
- `GET/PATCH /api/reminders`：读取和修改7天、3天、1天、当天及信息变更提醒；
- `GET /api/notifications`、`PATCH /api/notifications/:notificationId`：消息中心和已读状态；
- `POST /api/cron/recruitment-deadline-reminders`：每日任务，使用 `Authorization: Bearer $CRON_SECRET` 调用。

提醒只针对 `FIXED_DATE` 且已经核验的截止时间，数据库保存 UTC，业务时区为 `Asia/Shanghai`。生产环境必须配置真实 PostgreSQL 连接和数据库适配器；未配置时接口返回 503，不使用浏览器或内存数据冒充提醒成功。

## 安全清理

```bash
node backend/scripts/cleanup-demo-data.mjs
```

清理脚本默认只读审计，不对数据库或业务文件做广泛删除。

## 长期招聘/招考信息源池 Agent

现有 Playwright 核验结果已作为增量 Source Pool 的第一批数据，新增了机构指纹、来源指纹、Discovery Queue、每日探索运行和组织关系表；实施说明与迁移/导入/运行命令见 [docs/source-pool-agent.md](docs/source-pool-agent.md)。
