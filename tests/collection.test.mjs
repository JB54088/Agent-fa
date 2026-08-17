import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const { SafeSourceHttpClient, SourceRequestError, isPrivateIp, validateSourceUrl } = await import("../lib/collection/http-client.ts");
const { detectAttachmentKind, validateAttachment } = await import("../lib/collection/attachments.ts");
const { contentHash } = await import("../lib/collection/hash.ts");
const { classifyDuplicate } = await import("../lib/collection/dedupe.ts");
const { detectOpportunityChanges } = await import("../lib/collection/change-detection.ts");
const { detectDeadlineType, parseDateFromText } = await import("../lib/collection/normalize.ts");
const { extractHtmlListItems, parseCsvLine } = await import("../lib/collection/parsers.ts");
const { canPublishCollectionItem, createReviewTask } = await import("../lib/collection/review.ts");

const source = {
  id: "source-1",
  organizationId: "org-1",
  sourceName: "示例官方招聘来源",
  sourceDomain: "example.com",
  sourceUrl: "https://example.com",
  listPageUrl: "https://example.com/campus",
  detailUrlPattern: null,
  apiUrl: null,
  rssUrl: null,
  robotsUrl: null,
  robotsResult: null,
  termsUrl: null,
  termsResult: null,
  requiresJavascript: false,
  requiresLogin: false,
  hasCaptcha: false,
  discoveryStatus: "AUTO_ALLOWED",
  automationAllowed: true,
  requestIntervalSeconds: 0,
  maxRequestsPerRun: 20,
  maxRequestsPerDay: 100,
  lastVerifiedAt: null,
  legalNotes: null,
  technicalNotes: null,
};

test("blocks private and unregistered source URLs", () => {
  assert.equal(isPrivateIp("127.0.0.1"), true);
  assert.equal(isPrivateIp("192.168.1.3"), true);
  assert.throws(() => validateSourceUrl("http://example.com", "example.com"), (error) => error instanceof SourceRequestError && error.code === "INVALID_URL");
  assert.throws(() => validateSourceUrl("https://not-example.com", "example.com"), (error) => error instanceof SourceRequestError && error.code === "SSRF_BLOCKED");
});

test("stops on 403 and 429 without retrying", async () => {
  for (const status of [403, 429]) {
    let calls = 0;
    const client = new SafeSourceHttpClient({ policy: { retryBackoffMs: 0 }, fetchImpl: async () => { calls += 1; return new Response("blocked", { status }); } });
    await assert.rejects(client.get(source, "https://example.com/campus"), (error) => error instanceof SourceRequestError && error.code === `HTTP_${status}`);
    assert.equal(calls, 1);
  }
});

test("enforces response size and safe discovery status", async () => {
  const large = new SafeSourceHttpClient({ policy: { maxResponseBytes: 4 }, fetchImpl: async () => new Response("12345", { status: 200 }) });
  await assert.rejects(large.get(source, "https://example.com/campus"), (error) => error instanceof SourceRequestError && error.code === "RESPONSE_TOO_LARGE");
  const manualSource = { ...source, discoveryStatus: "MANUAL_ONLY" };
  const client = new SafeSourceHttpClient({ fetchImpl: async () => new Response("ok") });
  await assert.rejects(client.get(manualSource, "https://example.com/campus"), (error) => error instanceof SourceRequestError && error.code === "SSRF_BLOCKED");
});

test("parses local HTML, CSV, PDF and spreadsheet descriptors", async () => {
  const html = await readFile(new URL("./fixtures/recruitment-list.html", import.meta.url), "utf8");
  assert.equal(extractHtmlListItems(html, "https://example.com/campus").length, 2);
  assert.deepEqual(parseCsvLine("示例单位,\"2027届校园招聘,技术岗\",2026-09-01"), ["示例单位", "2027届校园招聘,技术岗", "2026-09-01"]);
  assert.equal(detectAttachmentKind("公告.pdf", "application/pdf"), "PDF");
  assert.equal(detectAttachmentKind("岗位.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "XLSX");
  assert.equal(validateAttachment("岗位.xls", "application/vnd.ms-excel", 100).valid, true);
  assert.equal(validateAttachment("岗位.exe", "application/octet-stream", 100).valid, false);
});

test("handles dates and uncertain deadlines without inventing dates", () => {
  assert.equal(parseDateFromText("报名截止：2026年9月1日"), "2026-09-01");
  assert.equal(detectDeadlineType("本项目招满即止"), "UNTIL_FILLED");
  assert.equal(detectDeadlineType("报名时间另行通知"), "NOT_ANNOUNCED");
  assert.equal(detectDeadlineType("预计9月结束报名"), "ESTIMATED");
});

test("deduplicates by organization, season, batch, years, URLs, title and hash", () => {
  const candidate = { organizationId: "org-1", title: "示例单位2027届秋季校园招聘", recruitmentYear: 2027, recruitmentSeason: "AUTUMN", batchName: "正式批", targetGraduationYears: [2027], officialAnnouncementUrl: "https://example.com/a", officialApplicationUrl: null, publishedAt: "2026-08-01", contentHash: "hash-1" };
  assert.equal(classifyDuplicate(candidate, { ...candidate }), "EXACT_DUPLICATE");
  assert.equal(classifyDuplicate(candidate, { ...candidate, title: "示例单位2027届校招公告", contentHash: "hash-2", officialApplicationUrl: "https://example.com/b" }), "HIGHLY_LIKELY_DUPLICATE");
});

test("records changes and keeps new collection items behind review", async () => {
  const changes = detectOpportunityChanges({ deadline: "2026-08-20", status: "recruiting", major_requirement: "计算机类" }, { deadline: "2026-08-25", status: "recruiting", major_requirement: "计算机类" });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].notifyUsers, true);
  assert.equal(canPublishCollectionItem("PENDING"), false);
  assert.equal(canPublishCollectionItem("APPROVED"), true);
  assert.deepEqual(createReviewTask("raw-1", "NEW_ITEM"), { rawItemId: "raw-1", opportunityId: null, taskType: "NEW_ITEM", reviewStatus: "PENDING", automatedConfidence: null, reviewNotes: "所有采集结果必须经过管理员审核后才能发布。" });
  assert.equal(typeof await contentHash("校招雷达"), "string");
});
