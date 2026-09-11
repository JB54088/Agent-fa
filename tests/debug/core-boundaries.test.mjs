/**
 * 调试用例：核心纯函数的边界行为。
 *
 * 全部为离线、确定性的表驱动用例：不打网络、不连数据库、不依赖当前时钟。
 * 断言写成"期望的正确行为"，失败即缺陷报告。
 */
import assert from "node:assert/strict";
import test from "node:test";

const { isPrivateIp, isAllowedSourceHostname, validateSourceUrl, SourceRequestError } = await import("../../lib/collection/http-client.ts");
const { normalizeUrl } = await import("../../lib/source-pool/normalize.ts");
const { normalizeExcelDate, excelImportDedupeKey, normalizeExcelImportRow } = await import("../../lib/excel-import.ts");
const { detectAttachmentKind, validateAttachment } = await import("../../lib/collection/attachments.ts");
const { nextRetryDecision } = await import("../../lib/collection/retry-policy.ts");
const { parseDateFromText, detectDeadlineType } = await import("../../lib/collection/normalize.ts");

const isValidIsoDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// ---------------------------------------------------------------------------
// isPrivateIp —— SSRF 私网判定
// ---------------------------------------------------------------------------

test("isPrivateIp：拦截私网 IPv4、回环、链路本地与元数据地址", () => {
  const blocked = ["127.0.0.1", "10.0.0.1", "10.255.255.255", "192.168.1.1", "172.16.0.1", "172.31.255.255", "169.254.169.254", "localhost", "::1", "[::1]"];
  const missed = blocked.filter((host) => !isPrivateIp(host));
  assert.deepEqual(missed, [], `以下地址未被判定为私网：${missed.join(", ")}`);
});

test("isPrivateIp：172.32.0.1 属于公网段，不得误判（确认网段边界正确）", () => {
  assert.equal(isPrivateIp("172.32.0.1"), false);
  assert.equal(isPrivateIp("172.15.0.1"), false);
});

test("isPrivateIp：必须拦截 IPv4-mapped IPv6（回环与云元数据的映射写法）", () => {
  const blocked = [
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    new URL("https://[::ffff:127.0.0.1]/").hostname,
    new URL("https://[::ffff:169.254.169.254]/").hostname,
  ];
  const missed = blocked.filter((host) => !isPrivateIp(host));
  assert.deepEqual(missed, [], `以下 IPv4-mapped IPv6 写法未判定为私网：${missed.join(", ")}`);
});

test("isPrivateIp：必须拦截 0.0.0.0（多数系统上会解析到本机）", () => {
  assert.equal(isPrivateIp("0.0.0.0"), true);
});

test("isPrivateIp：不得误封仅仅以 fc / fd / fe80 开头的公网域名", () => {
  const publicHosts = ["fda.gov", "fcc.gov", "fdic.gov", "fc2.com", "fd-example.org", "fda.example.com"];
  const wronglyBlocked = publicHosts.filter((host) => isPrivateIp(host));
  assert.deepEqual(wronglyBlocked, [], `以下公网域名被误判为私有网络，会被以"来源地址指向私有网络"为由拒绝采集：${wronglyBlocked.join(", ")}`);
});

test("validateSourceUrl：IPv4-mapped IPv6 目前是被域名白名单兜住的（记录这条隐式依赖）", () => {
  // 该用例通过的原因不是 isPrivateIp 命中，而是域名白名单拒绝 IPv6 字面量主机。
  // 一旦白名单放宽（例如来源域名本身注册为 IP），上面的空隙就会变成真实可达的 SSRF。
  assert.throws(
    () => validateSourceUrl("https://[::ffff:127.0.0.1]/", "example.com"),
    (error) => error instanceof SourceRequestError && error.code === "SSRF_BLOCKED",
  );
});

// ---------------------------------------------------------------------------
// isAllowedSourceHostname / validateSourceUrl —— 域名白名单
// ---------------------------------------------------------------------------

test("isAllowedSourceHostname：接受同域与子域，拒绝前缀混淆和跨域后缀", () => {
  const allowed = [
    ["careers.oppo.com", "careers.oppo.com"],
    ["sub.example.com", "example.com"],
    ["www.example.com", "example.com"],
    ["example.com", "www.example.com"],
    ["EXAMPLE.COM", "example.com"],
    ["example.com.", "example.com"],
  ];
  const denied = [
    ["evilexample.com", "example.com"],
    ["example.com.evil.com", "example.com"],
    ["notexample.com", "example.com"],
    ["example.com.hk", "example.com"],
  ];
  const wrong = [];
  for (const [host, domain] of allowed) if (!isAllowedSourceHostname(host, domain)) wrong.push(`应放行却拒绝：${host} vs ${domain}`);
  for (const [host, domain] of denied) if (isAllowedSourceHostname(host, domain)) wrong.push(`应拒绝却放行：${host} vs ${domain}`);
  assert.deepEqual(wrong, [], wrong.join("\n"));
});

test("validateSourceUrl：只接受无认证信息的 HTTPS，且必须落在登记的官方域名内", () => {
  assert.equal(validateSourceUrl("https://careers.oppo.com/campus", "careers.oppo.com").hostname, "careers.oppo.com");
  assert.throws(() => validateSourceUrl("http://example.com", "example.com"), (error) => error.code === "INVALID_URL");
  assert.throws(() => validateSourceUrl("https://u:p@example.com", "example.com"), (error) => error.code === "INVALID_URL");
  assert.throws(() => validateSourceUrl("https://other.com", "example.com"), (error) => error.code === "SSRF_BLOCKED");
  assert.throws(() => validateSourceUrl("https://127.0.0.1", "example.com"), (error) => error.code === "SSRF_BLOCKED");
});

// ---------------------------------------------------------------------------
// normalizeUrl —— 来源 URL 归一化
// ---------------------------------------------------------------------------

test("normalizeUrl：去除跟踪参数、片段、www 前缀与默认端口，并排序查询参数", () => {
  const cases = [
    ["https://Example.com/jobs/?utm_source=mail&source=nav&id=7#top", "https://example.com/jobs?id=7"],
    ["https://www.example.com/x", "https://example.com/x"],
    ["https://example.com:443/x", "https://example.com/x"],
    ["http://example.com:80/x", "http://example.com/x"],
    ["https://example.com/jobs/", "https://example.com/jobs"],
    ["https://example.com/jobs", "https://example.com/jobs"],
    ["https://example.com/?b=2&a=1", "https://example.com/?a=1&b=2"],
    ["https://example.com/?token=secret", "https://example.com/"],
    ["https://example.com", "https://example.com/"],
  ];
  const failed = cases.filter(([input, expected]) => normalizeUrl(input) !== expected).map(([input, expected]) => `${input} → ${normalizeUrl(input)}（期望 ${expected}）`);
  assert.deepEqual(failed, [], failed.join("\n"));
});

test("normalizeUrl：空值返回空串，非法输入退化为去尾斜杠的小写文本", () => {
  assert.equal(normalizeUrl(null), "");
  assert.equal(normalizeUrl(undefined), "");
  assert.equal(normalizeUrl(""), "");
  assert.equal(normalizeUrl("  not a url  "), "not a url");
});

test("normalizeUrl：归一化是幂等的", () => {
  const samples = ["https://www.example.com/jobs/?utm_source=a&id=7#x", "http://example.com:80/", "https://example.com/a/b/"];
  for (const sample of samples) {
    const once = normalizeUrl(sample);
    assert.equal(normalizeUrl(once), once, `二次归一化结果不一致：${sample}`);
  }
});

// ---------------------------------------------------------------------------
// normalizeExcelDate —— Excel 日期解析
// ---------------------------------------------------------------------------

test("normalizeExcelDate：正确解析 5 位 Excel 日期序列", () => {
  const cases = [
    ["45566", "2024-10-01"],
    ["10000", "1927-05-18"],
    ["10001", "1927-05-19"],
    ["45566.75", "2024-10-01"],
  ];
  const failed = cases.filter(([input, expected]) => normalizeExcelDate(input) !== expected).map(([input, expected]) => `${input} → ${normalizeExcelDate(input)}（期望 ${expected}）`);
  assert.deepEqual(failed, [], failed.join("\n"));
});

test("normalizeExcelDate：拒绝不存在的日历日期", () => {
  assert.equal(normalizeExcelDate("2026/02/29"), null);
  assert.equal(normalizeExcelDate("2026-13-01"), null);
  assert.equal(normalizeExcelDate("2026年9月31日"), null);
});

test("normalizeExcelDate：低于 5 位的历史序列号返回 null（1900 闰年偏移因此不可达）", () => {
  // 记录当前行为：序列号必须恰好 5 位才进入序列号分支。
  // 这意味着经典的 1900 闰年差一天问题无法触发，但 1927 年之前的序列号会被静默丢弃。
  assert.equal(normalizeExcelDate("59"), null);
  assert.equal(normalizeExcelDate("60"), null);
  assert.equal(normalizeExcelDate("9999"), null);
});

test("normalizeExcelDate：解析中文与西文日期写法，并保留无法识别时的 null", () => {
  assert.equal(normalizeExcelDate("2026年9月30日"), "2026-09-30");
  assert.equal(normalizeExcelDate("2026-2-3"), "2026-02-03");
  assert.equal(normalizeExcelDate("8/24/2026"), "2026-08-24");
  assert.equal(normalizeExcelDate("招满即止"), null);
  assert.equal(normalizeExcelDate(""), null);
});

// ---------------------------------------------------------------------------
// excelImportDedupeKey —— 导入去重键
// ---------------------------------------------------------------------------

test("excelImportDedupeKey：对大小写与空格不敏感，且字段变化会改变键", () => {
  const base = normalizeExcelImportRow({ 企业名称: "示例科技", 招聘项目名称: "2027届秋季校园招聘", 招聘批次: "正式批", 毕业年份: "2027届", 官网: "https://example.com/campus" });

  assert.equal(excelImportDedupeKey(base, "org-1"), excelImportDedupeKey({ ...base }, "org-1"));
  assert.equal(
    excelImportDedupeKey(base, "org-1"),
    excelImportDedupeKey({ ...base, projectName: "2027届 秋季校园招聘" }, "org-1"),
  );
  assert.notEqual(excelImportDedupeKey(base, "org-1"), excelImportDedupeKey(base, "org-2"));
  assert.notEqual(excelImportDedupeKey(base, "org-1"), excelImportDedupeKey({ ...base, recruitmentBatch: "提前批" }, "org-1"));
  assert.equal(excelImportDedupeKey(base).startsWith("示例科技:"), true, "未传 organizationId 时应退化为企业名称");
});

test("excelImportDedupeKey：毕业年份缺失时使用 unknown 占位", () => {
  const row = normalizeExcelImportRow({ 企业名称: "示例科技", 招聘项目名称: "校园招聘", 官网: "https://example.com/campus" });
  assert.equal(row.graduationYear, null);
  assert.match(excelImportDedupeKey(row, "org-1"), /:unknown:/);
});

// ---------------------------------------------------------------------------
// parseDateFromText —— 不得产出不存在的日历日期
// ---------------------------------------------------------------------------

test("parseDateFromText：返回的日期必须是真实存在的日历日期（否则会把不存在的截止日写进流程）", () => {
  const samples = ["报名截止：2026年2月30日", "报名截止：2026年13月45日", "截止 2026年4月31日", "报名截止：2026年9月1日", "无日期"];
  const invalid = samples
    .map((text) => [text, parseDateFromText(text)])
    .filter(([, value]) => value !== null && !isValidIsoDate(value))
    .map(([text, value]) => `「${text}」→ ${value}`);

  assert.deepEqual(
    invalid,
    [],
    `parseDateFromText 产出了不存在的日历日期（同一个仓库里 normalizeExcelDate 会做日历校验，两者行为不一致）：\n${invalid.join("\n")}`,
  );
});

test("detectDeadlineType：各类截止表述的归类", () => {
  const cases = [
    ["本项目招满即止", "UNTIL_FILLED"],
    ["长期招聘", "LONG_TERM"],
    ["报名时间另行通知", "NOT_ANNOUNCED"],
    ["预计9月结束报名", "ESTIMATED"],
    ["报名截止：2026年9月1日", "FIXED_DATE"],
  ];
  const failed = cases.filter(([text, expected]) => detectDeadlineType(text) !== expected).map(([text, expected]) => `${text} → ${detectDeadlineType(text)}（期望 ${expected}）`);
  assert.deepEqual(failed, [], failed.join("\n"));
});

test("detectDeadlineType：完全不含截止信息的文本也归为 NOT_ANNOUNCED（记录「无信息」与「明确未公布」被合并）", () => {
  assert.equal(detectDeadlineType("中国石化2027届校园招聘公告"), "NOT_ANNOUNCED");
});

// ---------------------------------------------------------------------------
// 附件校验
// ---------------------------------------------------------------------------

test("validateAttachment：扩展名与 Content-Type 必须同时匹配白名单", () => {
  assert.equal(validateAttachment("公告.pdf", "application/pdf", 100).valid, true);
  assert.equal(validateAttachment("公告.PDF", "application/pdf", 100).valid, true);
  assert.equal(validateAttachment("岗位.xls", "application/vnd.ms-excel", 100).valid, true);
  assert.equal(validateAttachment("名单.csv", "text/csv; charset=utf-8", 100).valid, true);
  assert.equal(validateAttachment("公告.pdf", "application/octet-stream", 100).valid, false);
  assert.equal(validateAttachment("样本.pdf.exe", "application/octet-stream", 100).valid, false);
  assert.equal(validateAttachment("公告.exe", "application/octet-stream", 100).valid, false);
  assert.equal(detectAttachmentKind("文件.PDF", "application/pdf"), "PDF");
  assert.equal(detectAttachmentKind("文件.txt", "text/plain"), null);
});

test("validateAttachment：大小上限为闭区间，零字节文件被接受（记录当前宽松处）", () => {
  assert.equal(validateAttachment("公告.pdf", "application/pdf", 20_000_000).valid, true, "恰好等于上限应被接受");
  assert.equal(validateAttachment("公告.pdf", "application/pdf", 20_000_001).valid, false);
  assert.equal(validateAttachment("公告.pdf", "application/pdf", 0).valid, true, "零字节文件当前被判为有效");
});

// ---------------------------------------------------------------------------
// nextRetryDecision —— 采集重试策略全表
// ---------------------------------------------------------------------------

test("nextRetryDecision：全表行为（连续失败 >= 3 一律转人工复核，安全类失败不重试）", () => {
  const failures = ["SUCCESS", "TIMEOUT", "502", "EMPTY_BODY", "TOOL_ERROR", "SECURITY_POLICY", "REDIRECT_LOOP", "JAVASCRIPT_REQUIRED", "OTHER"];
  const table = {};
  for (const failure of failures) {
    table[failure] = [0, 1, 2, 3, 4].map((count) => nextRetryDecision(failure, count));
  }

  assert.deepEqual(table.SUCCESS, ["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);
  for (const failure of failures.filter((item) => item !== "SUCCESS")) {
    assert.deepEqual(table[failure].slice(3), ["NEEDS_REVIEW", "NEEDS_REVIEW"], `${failure} 连续失败 >= 3 时应转人工复核`);
  }
  assert.deepEqual(table.TIMEOUT.slice(0, 3), ["RETRY_ONCE", "SKIP", "SKIP"]);
  assert.deepEqual(table["502"].slice(0, 3), ["RETRY_ONCE", "SKIP", "SKIP"]);
  assert.deepEqual(table.SECURITY_POLICY, ["NEEDS_REVIEW", "NEEDS_REVIEW", "NEEDS_REVIEW", "NEEDS_REVIEW", "NEEDS_REVIEW"]);
  assert.deepEqual(table.JAVASCRIPT_REQUIRED.slice(0, 1), ["NEEDS_REVIEW"]);
  assert.deepEqual(table.REDIRECT_LOOP.slice(0, 1), ["NEEDS_REVIEW"]);
  assert.deepEqual(table.TOOL_ERROR.slice(0, 1), ["NEEDS_REVIEW"]);
  assert.deepEqual(table.EMPTY_BODY, ["SKIP", "SKIP", "SKIP", "NEEDS_REVIEW", "NEEDS_REVIEW"]);
  assert.deepEqual(table.OTHER, ["SKIP", "SKIP", "SKIP", "NEEDS_REVIEW", "NEEDS_REVIEW"]);
});
