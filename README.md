# 校招雷达

面向应届毕业生的招聘、招录与考试信息聚合及提醒平台。公开招聘信息保留官方来源、来源级别和最近核验时间，进入平台的新增数据必须经过人工审核后才可发布。

## 当前版本

- 前台展示 43 条人工整理、带官方入口的招聘记录，其中本次新增13条已核验的2027届校招、专项招聘和实习项目。
- 已导入教育部《普通高等学校本科专业目录（2026年）》883 条本科专业。
- 已导入国务院学位委员会、教育部《研究生教育学科专业目录（2022年）》181 条研究生学科和专业学位类别。
- 目录保留版本、代码、学科门类、来源 URL 和官方通知 URL。
- 原始采集、Excel 导入、页面变化和复核任务均以人工审核为发布闸门。
- 收藏截止提醒核心已支持截止前7天、3天、1天和可选当天提醒；消息通过站内通知展示。
- 已加入全国来源目录：国考官方来源、31个省级省考档案、央企名录入口、10个重点地区地方国企档案和企业招聘专题发现入口。已核验的国考、央企名录和31个省级入口已直接录入URL并记录核验日期；未核验的地方国企与企业发现入口仍为空，自动采集数为0。
- 不绕过登录、验证码、访问限制或反爬措施。

## 本地运行

```bash
npm install
npm run dev
```

## 校验与构建

```bash
npm run validate:major-directory
npm test
npm run build
```

## 专业目录更新

官方目录原始 PDF 由运营人员下载后，执行：

```bash
python3 scripts/import-official-major-directory.py \
  --undergraduate-pdf /path/to/undergraduate.pdf \
  --graduate-pdf /path/to/graduate.pdf
node scripts/validate-major-directory.mjs
```

导入说明见 [data/major-directory/README.md](data/major-directory/README.md)。数据库迁移见 `drizzle/0003_major_directory_formalization.sql`，目录版本和原始文件哈希应写入 `major_sources`、`major_directory_versions` 和 `major_import_runs`。

## 收藏截止提醒

提醒接口和每日任务位于：

- `POST/DELETE /api/favorites/:opportunityId`：收藏或取消收藏，并创建/取消未来提醒；
- `GET/PATCH /api/reminders`：读取和修改7天、3天、1天、当天及信息变更提醒；
- `GET /api/notifications`、`PATCH /api/notifications/:notificationId`：消息中心和已读状态；
- `POST /api/cron/recruitment-deadline-reminders`：每日任务，使用 `Authorization: Bearer $CRON_SECRET` 调用。

提醒只针对 `FIXED_DATE` 且已经核验的截止时间，数据库保存 UTC，业务时区为 `Asia/Shanghai`。生产环境必须配置真实 PostgreSQL 连接和数据库适配器；未配置时接口返回 503，不使用浏览器或内存数据冒充提醒成功。

## 安全清理

```bash
node scripts/cleanup-demo-data.mjs
```

清理脚本默认只读审计，不对数据库或业务文件做广泛删除。
