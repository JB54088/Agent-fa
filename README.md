# 校招雷达

面向应届毕业生的招聘、招录与考试信息聚合及提醒平台。公开招聘信息保留官方来源、来源级别和最近核验时间，进入平台的新增数据必须经过人工审核后才可发布。

## 当前版本

- 前台展示 30 条人工整理、带官方入口的招聘记录。
- 已导入教育部《普通高等学校本科专业目录（2026年）》883 条本科专业。
- 已导入国务院学位委员会、教育部《研究生教育学科专业目录（2022年）》181 条研究生学科和专业学位类别。
- 目录保留版本、代码、学科门类、来源 URL 和官方通知 URL。
- 原始采集、Excel 导入、页面变化和复核任务均以人工审核为发布闸门。
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

## 安全清理

```bash
node scripts/cleanup-demo-data.mjs
```

清理脚本默认只读审计，不对数据库或业务文件做广泛删除。
