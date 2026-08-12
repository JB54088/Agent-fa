import { and, count, eq, isNull, like, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "../../../db";

const sourceDirectoryMarker = "%source-directory-sync:v1%";

const categoryLabels = {
  ENTERPRISE: "重点企业",
  NATIONAL_CIVIL_SERVICE: "国考",
  PROVINCIAL_CIVIL_SERVICE: "省考",
  CENTRAL_SOE: "央企",
  LOCAL_SOE: "地方国企",
  ENTERPRISE_DISCOVERY: "企业发现",
} as const;

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.dataSources.id,
        name: schema.dataSources.name,
        category: schema.dataSources.sourceCategory,
        sourceUrl: schema.dataSources.sourceUrl,
        sourceDomain: schema.dataSources.sourceDomain,
        level: schema.dataSources.level,
        discoveryStatus: schema.dataSources.discoveryStatus,
        normalFrequency: schema.dataSources.normalFrequency,
        lastVerifiedAt: schema.dataSources.lastVerifiedAt,
        requiresManualReview: schema.dataSources.requiresManualReview,
        automationAllowed: schema.dataSources.automationAllowed,
        adminNote: schema.dataSources.adminNote,
      })
      .from(schema.dataSources)
      .where(like(schema.dataSources.adminNote, sourceDirectoryMarker));

    const publishedOpportunityRows = await db
      .select({
        sourceId: schema.opportunities.sourceId,
        opportunityCount: count(),
      })
      .from(schema.opportunities)
      .where(and(
        eq(schema.opportunities.publicationStatus, "published"),
        eq(schema.opportunities.isDemo, false),
        ne(schema.opportunities.opportunityRelevanceStatus, "NOT_AN_OPPORTUNITY"),
        or(
          isNull(schema.opportunities.sourceLevel),
          ne(schema.opportunities.sourceLevel, "D级"),
          eq(schema.opportunities.dSpecialApproval, true),
        ),
      ))
      .groupBy(schema.opportunities.sourceId);
    const opportunityCountBySource = new Map(
      publishedOpportunityRows
        .filter((row): row is { sourceId: string; opportunityCount: number } => Boolean(row.sourceId))
        .map((row) => [row.sourceId, Number(row.opportunityCount)]),
    );

    const sources = rows.map((row) => ({
      ...row,
      opportunityCount: opportunityCountBySource.get(row.id) ?? 0,
      categoryLabel: row.category ? categoryLabels[row.category as keyof typeof categoryLabels] ?? "其他来源" : "其他来源",
      statusLabel: row.discoveryStatus === "VERIFIED" ? "已核验入口" : "待人工核验",
      note: row.adminNote?.replace(/\s*\[source-directory-sync:v1\]\s*$/, "") ?? "",
      sourceUrl: row.sourceUrl ?? null,
      sourceDomain: row.sourceDomain ?? null,
      lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      summary: {
        total: sources.length,
        verified: sources.filter((source) => source.discoveryStatus === "VERIFIED").length,
        needsReview: sources.filter((source) => source.discoveryStatus === "NEEDS_REVIEW").length,
        enterprise: sources.filter((source) => source.category === "ENTERPRISE").length,
        nationalAndProvincial: sources.filter((source) => ["NATIONAL_CIVIL_SERVICE", "PROVINCIAL_CIVIL_SERVICE"].includes(source.category ?? "")).length,
        stateOwned: sources.filter((source) => ["CENTRAL_SOE", "LOCAL_SOE"].includes(source.category ?? "")).length,
      },
      sources,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "来源目录读取失败";
    return NextResponse.json({ ok: false, source: "database", error: message, summary: { total: 0, verified: 0, needsReview: 0, enterprise: 0, nationalAndProvincial: 0, stateOwned: 0 }, sources: [] }, { status: 503 });
  }
}
