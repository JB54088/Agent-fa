import { and, count, desc, eq, ilike, inArray, ne, or, isNull, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "../db/index";
import type { Project, ProjectStatus } from "../app/data";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const PUBLIC_CATALOG_CACHE_TTL_MS = 30_000;

export type PublishedProjectsOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  scope?: string;
  status?: string;
  companyType?: string;
  region?: string;
  matchOnly?: boolean;
  major?: string;
  ids?: string[];
};

export type PublishedProjectsResult = {
  items: Project[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PublishedOpportunitySummary = {
  total: number;
  recruiting: number;
  upcoming: number;
  ending: number;
  closed: number;
};

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
};

const catalogCache = new Map<string, CacheEntry<PublishedProjectsResult>>();
const summaryCache = new Map<string, CacheEntry<PublishedOpportunitySummary>>();

/** Invalidates only public catalog reads after an operator changes publication data. */
export function clearPublishedProjectsCache() {
  catalogCache.clear();
  summaryCache.clear();
}

async function cachedRead<T>(cache: Map<string, CacheEntry<T>>, key: string, read: () => Promise<T>) {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    if (existing.value !== undefined) return existing.value;
    if (existing.pending) return existing.pending;
  }

  const pending = read();
  cache.set(key, { expiresAt: now + PUBLIC_CATALOG_CACHE_TTL_MS, pending });
  try {
    const value = await pending;
    cache.set(key, { expiresAt: Date.now() + PUBLIC_CATALOG_CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

function dateValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function statusFor(row: { calculatedStatus: string; deadlineAt: Date | string | null; opportunityRelevanceStatus: string }): ProjectStatus {
  if (["HISTORICAL", "RECENT_CLOSED", "RESULT_NOTICE"].includes(row.opportunityRelevanceStatus)) return "closed";
  if (row.calculatedStatus !== "pending_review") return row.calculatedStatus as ProjectStatus;
  if (!row.deadlineAt) return "recruiting";
  return new Date(row.deadlineAt).getTime() < Date.now() ? "closed" : "recruiting";
}

function pageOptions(options: PublishedProjectsOptions) {
  const page = Number.isInteger(options.page) && (options.page as number) > 0 ? options.page as number : 1;
  const requestedPageSize = Number.isInteger(options.pageSize) && (options.pageSize as number) > 0 ? options.pageSize as number : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  return { page, pageSize };
}

function statusExpression() {
  return sql<string>`CASE
    WHEN ${schema.opportunities.opportunityRelevanceStatus} IN ('HISTORICAL', 'RECENT_CLOSED', 'RESULT_NOTICE') THEN 'closed'
    WHEN ${schema.opportunities.calculatedStatus} <> 'pending_review' THEN ${schema.opportunities.calculatedStatus}
    WHEN ${schema.opportunities.deadlineAt} IS NULL THEN 'recruiting'
    WHEN ${schema.opportunities.deadlineAt} < now() THEN 'closed'
    ELSE 'recruiting'
  END`;
}

function companyTypeCondition(value: string): SQL | undefined {
  const normalized = value.trim();
  if (!normalized || normalized === "全部类型") return undefined;
  if (normalized === "央企") {
    return or(eq(schema.opportunities.opportunityType, "CENTRAL_SOE"), ilike(schema.organizations.organizationType, "%央企%"));
  }
  if (normalized === "地方国企") {
    return or(eq(schema.opportunities.opportunityType, "LOCAL_SOE"), ilike(schema.organizations.organizationType, "%地方国企%"));
  }
  return or(ilike(schema.organizations.organizationType, `%${normalized}%`), ilike(schema.organizations.industry, `%${normalized}%`));
}

function scopeCondition(scope: string | undefined, major: string): SQL | undefined {
  if (!scope || scope === "全部") return undefined;
  const opportunityType = schema.opportunities.opportunityType;
  const recruitmentSeason = schema.opportunities.recruitmentSeason;
  const batchName = schema.opportunities.batchName;
  const organizationType = schema.organizations.organizationType;
  const displayType = schema.opportunities.displayType;
  const majorText = schema.opportunities.majorRequirementText;
  const status = statusExpression();

  switch (scope) {
    case "秋招":
      return or(eq(recruitmentSeason, "AUTUMN"), ilike(batchName, "%秋%"));
    case "春招":
      return or(eq(recruitmentSeason, "SPRING"), ilike(batchName, "%春%"));
    case "央企":
      return or(eq(opportunityType, "CENTRAL_SOE"), ilike(organizationType, "%央企%"));
    case "国企":
      return or(inArray(opportunityType, ["CENTRAL_SOE", "LOCAL_SOE"]), ilike(organizationType, "%国企%"));
    case "国考":
      return eq(opportunityType, "NATIONAL_CIVIL_SERVICE");
    case "省考":
      return eq(opportunityType, "PROVINCIAL_CIVIL_SERVICE");
    case "选调生":
      return eq(opportunityType, "SELECTED_GRADUATE");
    case "事业单位/事业编":
      return eq(opportunityType, "PUBLIC_INSTITUTION");
    case "军队文职":
      return eq(opportunityType, "MILITARY_CIVILIAN");
    case "官方招聘入口":
      return eq(displayType, "OFFICIAL_RECRUITMENT_ENTRY");
    case "大厂":
      return or(inArray(organizationType, ["互联网公司", "科技企业", "知名企业"]), ilike(schema.organizations.industry, "%互联网%"));
    case "即将截止":
      return sql`${status} = 'ending'`;
    case "不限专业":
      return or(eq(schema.opportunities.unlimitedMajor, true), ilike(majorText, "%不限专业%"), ilike(majorText, "%专业不限%"));
    case "与我匹配":
      return major.trim()
        ? or(eq(schema.opportunities.unlimitedMajor, true), ilike(majorText, `%${major.trim()}%`))
        : eq(schema.opportunities.unlimitedMajor, true);
    default:
      return undefined;
  }
}

function queryConditions(options: PublishedProjectsOptions): SQL[] {
  const conditions: SQL[] = [
    eq(schema.opportunities.publicationStatus, "published"),
    eq(schema.opportunities.isDemo, false),
    ne(schema.opportunities.opportunityRelevanceStatus, "NOT_AN_OPPORTUNITY"),
    or(
      isNull(schema.opportunities.sourceLevel),
      ne(schema.opportunities.sourceLevel, "D级"),
      eq(schema.opportunities.dSpecialApproval, true),
    ) as SQL,
  ];
  const search = options.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(
      ilike(schema.opportunities.title, pattern),
      ilike(schema.organizations.name, pattern),
      ilike(schema.opportunities.majorRequirementText, pattern),
      sql`${schema.opportunities.workLocations}::text ILIKE ${pattern}`,
    ) as SQL);
  }
  const scope = scopeCondition(options.scope, options.major ?? "");
  if (scope) conditions.push(scope);
  if (options.status && options.status !== "全部") conditions.push(sql`${statusExpression()} = ${options.status}`);
  const companyType = companyTypeCondition(options.companyType ?? "");
  if (companyType) conditions.push(companyType);
  const region = options.region?.trim();
  if (region && region !== "全部地区") conditions.push(sql`${schema.opportunities.workLocations}::text ILIKE ${`%${region}%`}`);
  if (options.matchOnly) {
    const major = options.major?.trim() ?? "";
    conditions.push(major ? or(eq(schema.opportunities.unlimitedMajor, true), ilike(schema.opportunities.majorRequirementText, `%${major}%`)) as SQL : eq(schema.opportunities.unlimitedMajor, true));
  }
  const ids = options.ids?.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids?.length) conditions.push(inArray(schema.opportunities.id, ids));
  return conditions;
}

const projectSelection = {
  id: schema.opportunities.id,
  title: schema.opportunities.title,
  organizationName: schema.organizations.name,
  organizationShortName: schema.organizations.shortName,
  organizationType: schema.organizations.organizationType,
  organizationIndustry: schema.organizations.industry,
  batchName: schema.opportunities.batchName,
  recruitmentSeason: schema.opportunities.recruitmentSeason,
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
  displayType: schema.opportunities.displayType,
  sourceLinkStatus: schema.dataSources.recruitmentLinkStatus,
  dSpecialApproval: schema.opportunities.dSpecialApproval,
};

function mapProject(row: Record<string, any>): Project {
  const announcementUrl = row.announcementUrl ?? row.applicationUrl ?? "";
  const applicationUrl = row.applicationUrl ?? row.announcementUrl ?? "";
  const majorText = row.originalMajors ?? "以官方岗位详情为准";
  const majors = majorText.match(/[\u4e00-\u9fa5]{2,}(?:科学与技术|工程|学|专业)/g) ?? [];
  const sourceLevel = row.sourceLevel ?? "A级";
  const status = statusFor({ calculatedStatus: row.calculatedStatus, deadlineAt: row.deadlineAt, opportunityRelevanceStatus: row.opportunityRelevanceStatus });
  return {
    id: row.id,
    company: row.organizationName ?? "待匹配企业",
    shortName: row.organizationShortName ?? row.organizationName ?? "招聘单位",
    logoTone: "teal",
    companyType: row.organizationType ?? row.opportunityType,
    companyNature: row.organizationIndustry ?? "招聘单位",
    batch: row.batchName ?? "公开招聘",
    recruitmentSeason: row.recruitmentSeason ?? undefined,
    title: row.title,
    intro: row.description ?? majorText,
    graduationYears: (row.graduationYears ?? []).map(String),
    degrees: row.degrees ?? [],
    originalMajors: majorText,
    majors,
    majorCategory: [],
    relatedMajor: true,
    noMajorLimit: row.unlimitedMajor === true || /不限专业|专业不限/.test(majorText),
    regions: row.locations ?? ["全国"],
    publishedAt: dateValue(row.publishedAt),
    startAt: dateValue(row.startAt),
    deadline: dateValue(row.deadlineAt),
    opportunityType: row.opportunityType,
    deadlineType: row.deadlineType,
    opportunityRelevanceStatus: row.opportunityRelevanceStatus,
    displayType: row.displayType === "OFFICIAL_RECRUITMENT_ENTRY" ? "OFFICIAL_RECRUITMENT_ENTRY" : "RECRUITMENT_PROJECT",
    sourceLinkStatus: row.sourceLinkStatus ?? undefined,
    status,
    sourceName: row.sourceName ?? "官方来源",
    sourceLevel,
    sourceType: row.sourceType ?? "企业官网",
    announcementUrl: row.announcementUrl ?? undefined,
    applicationUrl: row.applicationUrl ?? undefined,
    officialPageStatus: row.verificationStatus === "verified" ? "可访问" : row.verificationStatus === "needs_review" ? "待复核" : "待复核",
    verifiedAt: dateValue(row.lastVerifiedAt),
    recommended: status !== "closed",
    link: applicationUrl || announcementUrl,
    recordStatus: "真实数据",
  } satisfies Project;
}

async function readPublishedProjects(options: PublishedProjectsOptions): Promise<PublishedProjectsResult> {
  const { page, pageSize } = pageOptions(options);
  const conditions = queryConditions(options);
  const db = getDb();
  const where = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select({ ...projectSelection, unlimitedMajor: schema.opportunities.unlimitedMajor })
      .from(schema.opportunities)
      .leftJoin(schema.organizations, eq(schema.opportunities.organizationId, schema.organizations.id))
      .leftJoin(schema.dataSources, eq(schema.opportunities.sourceId, schema.dataSources.id))
      .where(where)
      .orderBy(
        sql`CASE WHEN ${schema.opportunities.displayType} = 'OFFICIAL_RECRUITMENT_ENTRY' THEN 1 ELSE 0 END`,
        sql`CASE WHEN ${statusExpression()} = 'ending' THEN 0 WHEN ${statusExpression()} = 'recruiting' THEN 1 WHEN ${statusExpression()} = 'upcoming' THEN 2 ELSE 3 END`,
        desc(schema.opportunities.updatedAt),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() })
      .from(schema.opportunities)
      .leftJoin(schema.organizations, eq(schema.opportunities.organizationId, schema.organizations.id))
      .leftJoin(schema.dataSources, eq(schema.opportunities.sourceId, schema.dataSources.id))
      .where(where),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  return { items: rows.map((row) => mapProject(row as Record<string, any>)), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/** Reads only published, non-demo opportunities. This path is SELECT-only. */
export async function listPublishedProjects(options: PublishedProjectsOptions = {}): Promise<PublishedProjectsResult> {
  const normalized = { ...options, ...pageOptions(options), search: options.search?.trim() ?? "", scope: options.scope ?? "全部", status: options.status ?? "全部", companyType: options.companyType ?? "全部类型", region: options.region ?? "全部地区", major: options.major?.trim() ?? "", ids: options.ids?.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).sort() ?? [] };
  return cachedRead(catalogCache, JSON.stringify(normalized), () => readPublishedProjects(normalized));
}

async function readPublishedOpportunitySummary(): Promise<PublishedOpportunitySummary> {
  const conditions = queryConditions({});
  const db = getDb();
  const [row] = await db.select({
    total: count(),
    recruiting: sql<number>`count(*) FILTER (WHERE ${statusExpression()} = 'recruiting')`,
    upcoming: sql<number>`count(*) FILTER (WHERE ${statusExpression()} = 'upcoming')`,
    ending: sql<number>`count(*) FILTER (WHERE ${statusExpression()} = 'ending')`,
    closed: sql<number>`count(*) FILTER (WHERE ${statusExpression()} = 'closed')`,
  }).from(schema.opportunities)
    .leftJoin(schema.organizations, eq(schema.opportunities.organizationId, schema.organizations.id))
    .leftJoin(schema.dataSources, eq(schema.opportunities.sourceId, schema.dataSources.id))
    .where(and(...conditions));
  return {
    total: Number(row?.total ?? 0),
    recruiting: Number(row?.recruiting ?? 0),
    upcoming: Number(row?.upcoming ?? 0),
    ending: Number(row?.ending ?? 0),
    closed: Number(row?.closed ?? 0),
  };
}

export function getPublishedOpportunitySummary() {
  return cachedRead(summaryCache, "published-summary", readPublishedOpportunitySummary);
}
