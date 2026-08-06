import { organizationsSeed, type OrganizationPriority } from "./organizations.ts";

export type SourceDiscoveryStatus = "AUTO_ALLOWED" | "ATTACHMENT_ONLY" | "MANUAL_ONLY" | "NEEDS_REVIEW" | "BLOCKED" | "INACTIVE" | "UNKNOWN";

export type DataSourceSeed = {
  organizationName: string;
  sourceName: string;
  sourceDomain: null;
  sourceUrl: null;
  sourceType: null;
  officialLevel: "A级";
  sourceStatus: SourceDiscoveryStatus;
  crawlerStrategy: "MANUAL_SOURCE_AUDIT";
  listPageUrl: null;
  detailUrlPattern: null;
  apiUrl: null;
  rssUrl: null;
  robotsUrl: null;
  termsUrl: null;
  requiresJavascript: null;
  requiresLogin: null;
  hasCaptcha: null;
  recommendedFrequency: "P0_PEAK_DAILY" | "P1_EVERY_2_3_DAYS" | "P2_WEEKLY";
  automationAllowed: false;
  priority: OrganizationPriority;
  officialConfirmed: false;
  lastVerifiedAt: null;
  notes: string;
};

function frequencyFor(priority: OrganizationPriority): DataSourceSeed["recommendedFrequency"] {
  if (priority === "P0") return "P0_PEAK_DAILY";
  if (priority === "P1") return "P1_EVERY_2_3_DAYS";
  return "P2_WEEKLY";
}

export const dataSourcesSeed: DataSourceSeed[] = organizationsSeed.map((organization) => ({
  organizationName: organization.name,
  sourceName: `${organization.shortName}官方招聘来源（待核验）`,
  sourceDomain: null,
  sourceUrl: null,
  sourceType: null,
  officialLevel: "A级",
  sourceStatus: "NEEDS_REVIEW",
  crawlerStrategy: "MANUAL_SOURCE_AUDIT",
  listPageUrl: null,
  detailUrlPattern: null,
  apiUrl: null,
  rssUrl: null,
  robotsUrl: null,
  termsUrl: null,
  requiresJavascript: null,
  requiresLogin: null,
  hasCaptcha: null,
  recommendedFrequency: frequencyFor(organization.priority),
  automationAllowed: false,
  priority: organization.priority,
  officialConfirmed: false,
  lastVerifiedAt: null,
  notes: "尚未完成官方域名、招聘入口、robots.txt及服务条款核验；不得自动采集。",
}));

if (dataSourcesSeed.length !== 100) {
  throw new Error(`Expected 100 source records, received ${dataSourcesSeed.length}`);
}
