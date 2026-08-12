import { and, eq, isNull, like, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../chatgpt-auth";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl, getDb, schema } from "../../../db";
import { ensureOfficialUrlLifecycle } from "../../../lib/official-url-lifecycle";

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) return false;
  const db = getDb();
  const rows = await db.select({ id: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.userId, schema.users.id))
    .where(eq(schema.users.email, user.email))
    .limit(1);
  return Boolean(rows[0]);
}

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
    if (!(await requireAdmin())) return NextResponse.json({ ok: false, error: "admin_authentication_required" }, { status: 403 });
    const sql = neon(getDatabaseUrl());
    await ensureOfficialUrlLifecycle(sql);
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
        officialUrlStatus: schema.dataSources.officialUrlStatus,
        officialUrlRegisteredAt: schema.dataSources.officialUrlRegisteredAt,
        officialUrlPublishedAt: schema.dataSources.officialUrlPublishedAt,
      })
      .from(schema.dataSources)
      .where(like(schema.dataSources.adminNote, sourceDirectoryMarker));

    const publishedOpportunityRows = await db
      .select({
        sourceId: schema.opportunities.sourceId,
        sourceName: schema.dataSources.name,
      })
      .from(schema.opportunities)
      .leftJoin(schema.dataSources, eq(schema.opportunities.sourceId, schema.dataSources.id))
      .where(and(
        eq(schema.opportunities.publicationStatus, "published"),
        eq(schema.opportunities.isDemo, false),
        ne(schema.opportunities.opportunityRelevanceStatus, "NOT_AN_OPPORTUNITY"),
        or(
          isNull(schema.opportunities.sourceLevel),
          ne(schema.opportunities.sourceLevel, "D级"),
          eq(schema.opportunities.dSpecialApproval, true),
        ),
      ));
    const normalizeSourceName = (value: string) => value
      .replace(/（待复核）|（待核验）|集团|有限责任公司|有限公司|官方|招聘|校园|官网|来源|档案/g, "")
      .replace(/[\s()（）·、及和与_-]/g, "")
      .toLowerCase();
    const opportunityCountBySource = new Map<string, number>();
    const opportunityCountByName = new Map<string, number>();
    for (const opportunity of publishedOpportunityRows) {
      if (opportunity.sourceId) opportunityCountBySource.set(opportunity.sourceId, (opportunityCountBySource.get(opportunity.sourceId) ?? 0) + 1);
      if (opportunity.sourceName) {
        const key = normalizeSourceName(opportunity.sourceName);
        opportunityCountByName.set(key, (opportunityCountByName.get(key) ?? 0) + 1);
      }
    }

    const sources = rows.map((row) => ({
      ...row,
      opportunityCount: opportunityCountBySource.get(row.id) ?? opportunityCountByName.get(normalizeSourceName(row.name)) ?? 0,
      categoryLabel: row.category ? categoryLabels[row.category as keyof typeof categoryLabels] ?? "其他来源" : "其他来源",
      statusLabel: row.officialUrlStatus === "PUBLISHED" ? "已发布官方入口" : row.officialUrlStatus === "REGISTERED" ? "已登记官方URL" : "待登记官方URL",
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
        verified: sources.filter((source) => source.officialUrlStatus === "PUBLISHED").length,
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
