import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.ts";

type CollectedItem = {
  id: string;
  batch_id: string;
  source_url: string;
  source_domain: string;
  title: string;
  raw_text: string;
  published_at: string | null;
  fetched_at: string;
  content_hash: string;
  parser_name: string;
  parse_status: "success" | "partial" | "failed";
  review_status: string;
  duplicate_status: "unique" | "suspected" | "confirmed" | "not_duplicate";
  normalized: Record<string, unknown>;
  decision: string;
};

const batchPath = resolve(process.cwd(), "logs/national-collection/2026-08-11/raw_source_items.json");
const publishVerifiedPdd = process.argv.includes("--publish-verified-pdd");

function dateOrNull(value: string | null | undefined): string | null {
  return value || null;
}

function sourceCategory(item: CollectedItem) {
  const type = String(item.normalized.type ?? "");
  if (type === "PROVINCIAL_CIVIL_SERVICE") return "PROVINCIAL_CIVIL_SERVICE" as const;
  if (type === "NATIONAL_CIVIL_SERVICE") return "NATIONAL_CIVIL_SERVICE" as const;
  return "ENTERPRISE" as const;
}

function opportunityType(item: CollectedItem) {
  const type = String(item.normalized.type ?? "");
  if (type === "PROVINCIAL_CIVIL_SERVICE") return "PROVINCIAL_CIVIL_SERVICE" as const;
  if (type === "NATIONAL_CIVIL_SERVICE") return "NATIONAL_CIVIL_SERVICE" as const;
  return "ENTERPRISE_CAMPUS" as const;
}

function isPdd(item: CollectedItem) {
  return item.source_domain === "careers.pddglobalhr.com";
}

function dedupeKey(item: CollectedItem, organizationId: string) {
  const year = item.normalized.year == null ? "不限" : String(item.normalized.year);
  const batch = String(item.normalized.batch ?? "未标明批次");
  return `${organizationId}:${item.title.trim()}:${year}:${batch}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required; current batch was not imported.");
  const items = JSON.parse(await readFile(batchPath, "utf8")) as CollectedItem[];
  const db = getDb();
  const summary = { rawInserted: 0, stagingInserted: 0, published: 0, pendingReview: 0 };

  await db.transaction(async (tx) => {
    const rawIds = new Map<string, string>();
    const organizationIds = new Map<string, string>();
    const sourceIds = new Map<string, string>();

    for (const item of items) {
      const organizationName = String(item.normalized.organization ?? item.source_domain);
      let organizationId = organizationIds.get(organizationName) ?? "";
      if (!organizationId) {
        const existing = await tx.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.name, organizationName)).limit(1);
        organizationId = existing[0]?.id ?? "";
        if (!organizationId) {
          const inserted = await tx.insert(schema.organizations).values({
            name: organizationName,
            shortName: organizationName,
            organizationType: String(item.normalized.type ?? "招聘单位"),
            level: "重点来源",
            priority: isPdd(item) ? "P0" : "P1",
          }).returning({ id: schema.organizations.id });
          organizationId = inserted[0].id;
        }
        if (!organizationId) throw new Error(`Could not resolve organization: ${organizationName}`);
        organizationIds.set(organizationName, organizationId);
      }

      let sourceId = sourceIds.get(item.source_url) ?? "";
      if (!sourceId) {
        const existing = await tx.select({ id: schema.dataSources.id }).from(schema.dataSources).where(eq(schema.dataSources.sourceUrl, item.source_url)).limit(1);
        sourceId = existing[0]?.id ?? "";
        if (!sourceId) {
          const inserted = await tx.insert(schema.dataSources).values({
            name: `${organizationName}官方来源`,
            organizationId,
            level: "A级",
            sourceCategory: sourceCategory(item),
            sourceType: item.source_domain.includes("gov.cn") ? "政府官网" : "企业官网",
            collectionMethod: "HTML页面",
            sourceUrl: item.source_url,
            sourceDomain: item.source_domain,
            discoveryStatus: "VERIFIED",
            automationAllowed: false,
            requiresManualReview: true,
            checkFrequency: "manual",
            adminNote: "本批次人工访问记录；自动采集权限仍关闭。",
          }).returning({ id: schema.dataSources.id });
          sourceId = inserted[0].id;
        }
        if (!sourceId) throw new Error(`Could not resolve source: ${item.source_url}`);
        sourceIds.set(item.source_url, sourceId);
      }

      const existingRaw = await tx.select({ id: schema.rawSourceItems.id }).from(schema.rawSourceItems).where(eq(schema.rawSourceItems.contentHash, item.content_hash)).limit(1);
      let rawId = existingRaw[0]?.id ?? "";
      if (!rawId) {
        const rawValues = {
          dataSourceId: sourceId,
          sourceUrl: item.source_url,
          originalTitle: item.title,
          originalContent: item.raw_text,
          collectedAt: dateOrNull(item.fetched_at) ?? new Date(),
          publishedAt: dateOrNull(item.published_at),
          contentHash: item.content_hash,
          parserName: item.parser_name,
          parserResult: { externalId: item.id, batchId: item.batch_id, normalized: item.normalized, legacyReviewStatus: item.review_status, legacyDecision: item.decision },
          parseStatus: item.parse_status,
          reviewStatus: "pending",
          duplicateStatus: item.duplicate_status,
          contentSummary: item.raw_text.slice(0, 400),
        } as unknown as typeof schema.rawSourceItems.$inferInsert;
        const inserted = await tx.insert(schema.rawSourceItems).values(rawValues).returning({ id: schema.rawSourceItems.id });
        rawId = inserted[0].id;
        summary.rawInserted += 1;
      }
      if (!rawId) throw new Error(`Could not resolve raw item: ${item.id}`);
      rawIds.set(item.id, rawId);

      const key = dedupeKey(item, organizationId);
      const existingStaging = await tx.select({ id: schema.stagingOpportunities.id }).from(schema.stagingOpportunities).where(eq(schema.stagingOpportunities.dedupeKey, key)).limit(1);
      if (existingStaging.length) continue;

      const isPddVerified = isPdd(item) && item.review_status === "approved";
      const stagingRows = await tx.insert(schema.stagingOpportunities).values({
        rawSourceItemId: rawId,
        dataSourceId: sourceId,
        organizationId,
        companyName: organizationName,
        projectName: item.title,
        recruitmentBatch: String(item.normalized.batch ?? "未标明批次"),
        graduationYears: item.normalized.year == null ? [] : [Number(item.normalized.year)],
        degreeRequirements: [],
        originalMajorText: isPdd(item) ? "以官方岗位详情为准" : item.raw_text.slice(0, 500),
        normalizedMajorNames: [],
        majorCategories: [],
        workLocations: [String(item.normalized.region ?? "全国")],
        publishedAt: dateOrNull(item.published_at),
        announcementUrl: item.source_url,
        applicationUrl: item.source_url,
        relevanceStatus: isPddVerified ? "CURRENT_OPEN" : "HISTORICAL",
        validationErrors: [],
        dedupeKey: key,
        reviewStatus: publishVerifiedPdd && isPddVerified ? "APPROVED" : "PENDING",
        reviewerNote: publishVerifiedPdd && isPddVerified ? "沿用批次日志中的人工核验结论；未绕过原始层。" : "待管理员在数据库审核工作台复核。",
      }).returning({ id: schema.stagingOpportunities.id });
      summary.stagingInserted += 1;

      if (!publishVerifiedPdd || !isPddVerified) {
        summary.pendingReview += 1;
        continue;
      }

      const existingOpportunity = await tx.select({ id: schema.opportunities.id }).from(schema.opportunities).where(and(eq(schema.opportunities.organizationId, organizationId), eq(schema.opportunities.title, item.title))).limit(1);
      let opportunityId = existingOpportunity[0]?.id;
      if (!opportunityId) {
        const inserted = await tx.insert(schema.opportunities).values({
          title: item.title,
          organizationId,
          opportunityType: opportunityType(item),
          recruitmentSeason: String(item.normalized.season ?? ""),
          recruitmentYear: item.normalized.year == null ? null : Number(item.normalized.year),
          targetGraduationYears: item.normalized.year == null ? [] : [Number(item.normalized.year)],
          batchName: String(item.normalized.batch ?? "未标明批次"),
          description: item.raw_text,
          workLocations: ["全国"],
          degreeRequirements: [],
          majorRequirementText: "以官方岗位详情为准",
          officialAnnouncementUrl: item.source_url,
          officialApplicationUrl: item.source_url,
          sourceId,
          sourceLevel: "A级",
          verificationStatus: "verified",
          lastVerifiedAt: new Date(),
          publicationStatus: "published",
          calculatedStatus: "recruiting",
          manualStatus: "recruiting",
          opportunityRelevanceStatus: "CURRENT_OPEN",
          deadlineType: String(item.normalized.deadline_type ?? "NOT_ANNOUNCED") as "NOT_ANNOUNCED",
          dataCredibility: "A级官方页面 + 人工核验",
          isDemo: false,
        }).returning({ id: schema.opportunities.id });
        opportunityId = inserted[0].id;
        summary.published += 1;
      }
      await tx.update(schema.stagingOpportunities).set({ promotedOpportunityId: opportunityId, updatedAt: new Date() }).where(eq(schema.stagingOpportunities.id, stagingRows[0].id));
      await tx.update(schema.rawSourceItems).set({ promotedOpportunityId: opportunityId, reviewStatus: "converted", reviewedAt: new Date(), updatedAt: new Date() }).where(eq(schema.rawSourceItems.id, rawId));
    }
  });

  console.log(JSON.stringify({ batch: batchPath, publishVerifiedPdd, ...summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
