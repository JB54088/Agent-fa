import test from "node:test";
import assert from "node:assert/strict";
import { buildSourcePoolImportPlan } from "../lib/source-pool/import-plan.ts";
import { normalizeOrganizationName, normalizeUrl } from "../lib/source-pool/normalize.ts";
import { extractDiscoveryCandidates } from "../lib/source-discovery/playwright-explorer.ts";
import { discoveryQueueFingerprint } from "../lib/source-discovery/queue.ts";

test("source pool import preserves multiple URLs per organization and deduplicates exact sources", async () => {
  const plan = await buildSourcePoolImportPlan(process.cwd());
  assert.equal(plan.duplicateSourceRecords, 0);
  assert.equal(plan.records.length, 141);
  assert.equal(plan.organizationCount, 138);
  assert.equal(plan.byCategory.central_soe, 91);
});

test("source pool normalization removes tracking/session parameters", () => {
  assert.equal(normalizeOrganizationName("腾讯（深圳）科技有限公司"), "腾讯深圳科技有限公司");
  assert.equal(normalizeUrl("https://Example.com/jobs/?utm_source=mail&source=nav&id=7#top"), "https://example.com/jobs?id=7");
});

test("Playwright exploration turns official internal links into queue candidates", () => {
  const seed = { organizationName: "中国石油天然气集团有限公司", category: "central_soe", province: "全国", url: "https://www.cnpc.com.cn/cnpc/jrwm/jrwm_index.shtml", parentOrganizationName: null };
  const candidates = extractDiscoveryCandidates(seed, seed.url, [
    { text: "校园招聘", href: "https://zhaopin.cnpc.com.cn/" },
    { text: "社会招聘", href: "/cnpc/shenhuizhaopin/zhaoping_list.shtml" },
    { text: "中国石油股份公司", href: "http://www.petrochina.com.cn/" },
  ], 20);
  assert.equal(candidates.length, 3);
  assert.equal(candidates.filter((candidate) => candidate.candidateType === "source").length, 2);
  assert.equal(candidates.find((candidate) => candidate.candidateType === "organization")?.name, "中国石油股份公司");
  assert.equal(discoveryQueueFingerprint(candidates[0]), discoveryQueueFingerprint({ ...candidates[0], candidateUrl: "https://zhaopin.cnpc.com.cn/?utm_source=mail" }));
});
