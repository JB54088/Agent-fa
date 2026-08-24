import assert from "node:assert/strict";
import test from "node:test";

const { excelImportDedupeKey, normalizeExcelDate, normalizeExcelImportRow } = await import("../lib/excel-import.ts");

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
test("阻止缺少官方链接或专业原文的Excel行", () => {
  const row = normalizeExcelImportRow({ 企业名称: "示例单位", 招聘项目名称: "校园招聘" });
  assert.ok(row.errors.includes("缺少招聘专业原文"));
  assert.ok(row.errors.includes("官方公告链接或官方报名链接至少填写一个"));
});

test("识别Excel日期序列并拒绝错误日期", () => {
  assert.equal(normalizeExcelDate("45566"), "2024-10-01");
  assert.equal(normalizeExcelDate("2026/02/29"), null);
  assert.equal(normalizeExcelDate("8/24/2026"), "2026-08-24");
});
