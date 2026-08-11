import { and, desc, eq, ne, or, isNull } from "drizzle-orm";
import { getDb, schema } from "../db/index";
import type { Project } from "../app/data";

function dateValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function statusFor(row: { calculatedStatus: string; deadlineAt: Date | string | null; opportunityRelevanceStatus: string }): Project["status"] {
  if (["HISTORICAL", "RECENT_CLOSED", "RESULT_NOTICE"].includes(row.opportunityRelevanceStatus)) return "closed";
  if (row.calculatedStatus !== "pending_review") return row.calculatedStatus as Project["status"];
  if (!row.deadlineAt) return "recruiting";
  return new Date(row.deadlineAt).getTime() < Date.now() ? "closed" : "recruiting";
}

/** Reads only published, non-demo opportunities from the canonical database. */
export async function listPublishedProjects(): Promise<Project[]> {
  const db = getDb();
  const rows = await db.select({
    id: schema.opportunities.id,
    title: schema.opportunities.title,
    organizationName: schema.organizations.name,
    organizationShortName: schema.organizations.shortName,
    organizationType: schema.organizations.organizationType,
    organizationIndustry: schema.organizations.industry,
    batchName: schema.opportunities.batchName,
    description: schema.opportunities.description,
    graduationYears: schema.opportunities.targetGraduationYears,
    degrees: schema.opportunities.degreeRequirements,
    originalMajors: schema.opportunities.majorRequirementText,
    locations: schema.opportunities.workLocations,
    publishedAt: schema.opportunities.createdAt,
    startAt: schema.opportunities.createdAt,
    deadlineAt: schema.opportunities.deadlineAt,
    opportunityType: schema.opportunities.opportunityType,
    deadlineType: schema.opportunities.deadlineType,
    announcementUrl: schema.opportunities.officialAnnouncementUrl,
    applicationUrl: schema.opportunities.officialApplicationUrl,
    sourceName: schema.dataSources.name,
    sourceLevel: schema.opportunities.sourceLevel,
    sourceType: schema.dataSources.sourceType,
    verificationStatus: schema.opportunities.verificationStatus,
    lastVerifiedAt: schema.opportunities.lastVerifiedAt,
    calculatedStatus: schema.opportunities.calculatedStatus,
      opportunityRelevanceStatus: schema.opportunities.opportunityRelevanceStatus,
      dSpecialApproval: schema.opportunities.dSpecialApproval,
  }).from(schema.opportunities)
    .leftJoin(schema.organizations, eq(schema.opportunities.organizationId, schema.organizations.id))
    .leftJoin(schema.dataSources, eq(schema.opportunities.sourceId, schema.dataSources.id))
    .where(and(
      eq(schema.opportunities.publicationStatus, "published"),
      eq(schema.opportunities.isDemo, false),
      ne(schema.opportunities.opportunityRelevanceStatus, "NOT_AN_OPPORTUNITY"),
      or(isNull(schema.opportunities.sourceLevel), ne(schema.opportunities.sourceLevel, "D级"), eq(schema.opportunities.dSpecialApproval, true)),
    ))
    .orderBy(desc(schema.opportunities.updatedAt));

  return rows.map((row) => {
    const announcementUrl = row.announcementUrl ?? row.applicationUrl ?? "";
    const applicationUrl = row.applicationUrl ?? row.announcementUrl ?? "";
    const majorText = row.originalMajors ?? "以官方岗位详情为准";
    const majors = majorText.match(/[\u4e00-\u9fa5]{2,}(?:科学与技术|工程|学|专业)/g) ?? [];
    const sourceLevel = row.sourceLevel ?? "A级";
    return {
      id: row.id,
      company: row.organizationName ?? "待匹配企业",
      shortName: row.organizationShortName ?? row.organizationName ?? "招聘单位",
      logoTone: "teal",
      companyType: row.organizationType ?? row.opportunityType,
      companyNature: row.organizationIndustry ?? "招聘单位",
      batch: row.batchName ?? "公开招聘",
      title: row.title,
      intro: row.description ?? majorText,
      graduationYears: (row.graduationYears ?? []).map(String),
      degrees: row.degrees ?? [],
      originalMajors: majorText,
      majors,
      majorCategory: [],
      relatedMajor: true,
      noMajorLimit: /不限专业|专业不限/.test(majorText),
      regions: row.locations ?? ["全国"],
      publishedAt: dateValue(row.publishedAt),
      startAt: dateValue(row.startAt),
      deadline: dateValue(row.deadlineAt),
      opportunityType: row.opportunityType,
      deadlineType: row.deadlineType,
      opportunityRelevanceStatus: row.opportunityRelevanceStatus,
      status: statusFor(row),
      sourceName: row.sourceName ?? "官方来源",
      sourceLevel,
      sourceType: row.sourceType ?? "企业官网",
      announcementUrl: row.announcementUrl ?? undefined,
      applicationUrl: row.applicationUrl ?? undefined,
      officialPageStatus: row.verificationStatus === "verified" ? "可访问" : row.verificationStatus === "needs_review" ? "待复核" : "待复核",
      verifiedAt: dateValue(row.lastVerifiedAt),
      recommended: statusFor(row) !== "closed",
      link: applicationUrl || announcementUrl,
      recordStatus: "真实数据" as const,
    } satisfies Project;
  });
}
