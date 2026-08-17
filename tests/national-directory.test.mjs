import assert from "node:assert/strict";
import test from "node:test";

const { nationalSourceDirectory, nationalSourceDirectorySummary } = await import("../db/seeds/national-source-directory.ts");

test("全国来源目录覆盖国考、31省省考、央企和重点地方国企", () => {
  assert.equal(nationalSourceDirectorySummary.provincialCivilService, 31);
  assert.equal(nationalSourceDirectorySummary.centralSoe, 1);
  assert.equal(nationalSourceDirectorySummary.localSoe, 12);
  assert.equal(nationalSourceDirectorySummary.total, 46);
});

test("全国目录未核验来源不预填URL且不允许自动采集", () => {
  assert.equal(nationalSourceDirectorySummary.verified, 33);
  assert.equal(nationalSourceDirectorySummary.needsReview, 13);
  assert.ok(nationalSourceDirectory.every((source) => source.automationAllowed === false));
  assert.ok(nationalSourceDirectory.filter((source) => source.discoveryStatus === "VERIFIED").every((source) => source.sourceUrl && source.sourceDomain && source.lastVerifiedAt));
  assert.ok(nationalSourceDirectory.filter((source) => source.discoveryStatus === "NEEDS_REVIEW").every((source) => source.sourceUrl === null && source.sourceDomain === null && source.lastVerifiedAt === null));
  assert.equal(nationalSourceDirectorySummary.autoAllowed, 0);
});

test("省考普通期每7天，发布公告后升级为每日", () => {
  const provinceSource = nationalSourceDirectory.find((source) => source.category === "PROVINCIAL_CIVIL_SERVICE");
  assert.equal(provinceSource?.normalFrequency, "EVERY_7_DAYS");
  assert.equal(provinceSource?.activeFrequency, "DAILY");
  assert.deepEqual(provinceSource?.requiredOfficialRoles, ["公务员主管部门", "人事考试网站", "年度招录专题网站"]);
});
