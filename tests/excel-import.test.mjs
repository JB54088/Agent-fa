import assert from "node:assert/strict";
import test from "node:test";

const { parseExcelUpload } = await import("../lib/excel-file-parser.ts");
const { excelImportDedupeKey, normalizeExcelDate, normalizeExcelImportRow } = await import("../lib/excel-import.ts");

test("实际读取CSV招聘文件并解析出数据行", async () => {
  const file = new File([
    "\ufeff公司名称,招聘标题,招聘类别,官网,招聘链接,工作地点\n示例科技,2027届秋招,秋招,https://example.com/campus,https://example.com/apply,全国\n",
  ], "校招雷达测试导入.csv", { type: "text/csv" });
  const parsed = await parseExcelUpload(file);
  assert.deepEqual(parsed.headers.slice(0, 3), ["公司名称", "招聘标题", "招聘类别"]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]["公司名称"], "示例科技");
});

test("识别校招雷达Excel模板字段并生成待审核数据", () => {
  const row = normalizeExcelImportRow({
    企业名称: "示例科技有限公司",
    招聘项目名称: "2027届秋季校园招聘",
    招聘批次: "正式批",
    毕业年份: "2027届",
    学历要求: "本科、硕士",
    招聘专业原文: "计算机类、电子信息类",
    招聘地区: "上海、北京",
    报名截止时间: "2026年9月30日",
    官方公告链接: "https://example.com/campus/notice",
    来源级别: "A级",
    时间核验状态: "已核验",
  });
  assert.deepEqual(row.errors, []);
  assert.equal(row.companyName, "示例科技有限公司");
  assert.equal(row.graduationYear, 2027);
  assert.equal(row.recruitmentSeason, "AUTUMN");
  assert.equal(row.deadline, "2026-09-30");
  assert.deepEqual(row.degreeRequirements, ["本科", "硕士"]);
  assert.deepEqual(row.workLocations, ["上海", "北京"]);
  assert.match(excelImportDedupeKey(row, "org-1"), /^org-1:2027届秋季校园招聘:2027:正式批$/);
});
test("阻止缺少官方链接，但允许专业字段留待人工补充", () => {
  const row = normalizeExcelImportRow({ 企业名称: "示例单位", 招聘项目名称: "校园招聘" });
  assert.ok(row.errors.includes("官方公告链接或官方报名链接至少填写一个"));
  assert.ok(row.warnings.includes("招聘专业原文未填写，待管理员审核时补充"));
});

test("兼容常见招聘Excel表头并进入待审核数据", () => {
  const row = normalizeExcelImportRow({
    公司名称: "示例银行",
    企业类型: "银行",
    招聘类别: "秋招",
    招聘标题: "2027届校园招聘",
    官网: "https://example.com/campus",
    招聘链接: "https://example.com/apply",
    工作地点: "全国",
    招聘对象: "2027届毕业生",
    发布日期: "2026-08-24",
    信息来源: "示例银行招聘官网",
  });
  assert.deepEqual(row.errors, []);
  assert.equal(row.companyName, "示例银行");
  assert.equal(row.recruitmentType, "秋招");
  assert.equal(row.announcementUrl, "https://example.com/campus");
  assert.equal(row.applicationUrl, "https://example.com/apply");
  assert.equal(row.opportunityType, "BANK_CAMPUS");
  assert.equal(row.recruitmentSeason, "AUTUMN");
});

test("识别Excel日期序列并拒绝错误日期", () => {
  assert.equal(normalizeExcelDate("45566"), "2024-10-01");
  assert.equal(normalizeExcelDate("2026/02/29"), null);
  assert.equal(normalizeExcelDate("8/24/2026"), "2026-08-24");
});
