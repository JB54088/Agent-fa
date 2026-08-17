import { createHash } from "node:crypto";
import type { NormalizedSourcePoolRecord, SourcePoolCategory, SourcePoolImportRecord, SourcePoolOfficialStatus, SourcePoolSourceType } from "./types.ts";

const trackingKeys = new Set(["fbclid", "gclid", "jsessionid", "session", "sessionid", "sid", "source", "token", "ct6t", "ct6ts", "rf"]);

export function normalizeOrganizationName(value: string) {
  return value.normalize("NFKC").replace(/[\s\u3000]+/g, "").replace(/[（）()【】\[\]「」“”‘’、，。,.:：;；]/g, "").toLocaleLowerCase("zh-CN");
}

export function normalizeUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value.trim());
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (trackingKeys.has(lower) || lower.startsWith("utm_")) url.searchParams.delete(key);
    }
    const sorted = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    for (const [key, item] of sorted) url.searchParams.append(key, item);
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function mapPoolCategory(category: string): SourcePoolCategory {
  const mapping: Record<string, SourcePoolCategory> = {
    ENTERPRISE_CAMPUS: "big_company",
    ENTERPRISE: "big_company",
    CENTRAL_SOE: "central_soe",
    LOCAL_SOE: "local_soe",
    MILITARY_CIVILIAN: "military_civilian",
    PROVINCIAL_CIVIL_SERVICE: "provincial_civil_service",
    NATIONAL_CIVIL_SERVICE: "national_civil_service",
  };
  return mapping[category] ?? "big_company";
}

export function mapSourceType(sourceType: string, category: SourcePoolCategory): SourcePoolSourceType {
  if (category === "provincial_civil_service" || category === "national_civil_service") return "exam_site";
  if (sourceType.includes("sasac") || sourceType.includes("government") || category === "local_soe") return "government_site";
  if (sourceType.includes("recruitment") || sourceType.includes("campus") || sourceType.includes("military")) return "official_recruitment_page";
  if (sourceType.includes("career")) return "official_career_site";
  return "official_homepage";
}

function organizationType(category: SourcePoolCategory) {
  if (category === "central_soe") return "央企";
  if (category === "local_soe") return "地方国企";
  if (category === "big_company") return "知名企业";
  if (category === "military_civilian") return "军队文职";
  if (category === "provincial_civil_service") return "省考官方来源";
  return "国考官方来源";
}

function sourceTypeLabel(sourceType: SourcePoolSourceType, category: SourcePoolCategory) {
  if (sourceType === "government_site" || category.includes("civil_service") || category === "military_civilian") return "政府官网" as const;
  if (sourceType === "official_homepage") return "企业官网" as const;
  return "招聘官网" as const;
}

function sourceCategory(category: SourcePoolCategory): NormalizedSourcePoolRecord["sourceCategory"] {
  if (category === "central_soe") return "CENTRAL_SOE";
  if (category === "local_soe") return "LOCAL_SOE";
  if (category === "provincial_civil_service") return "PROVINCIAL_CIVIL_SERVICE";
  if (category === "national_civil_service") return "NATIONAL_CIVIL_SERVICE";
  return "ENTERPRISE";
}

export function normalizeSourcePoolRecord(record: SourcePoolImportRecord): NormalizedSourcePoolRecord {
  const poolCategory = mapPoolCategory(record.category);
  const poolSourceType = mapSourceType(record.sourceType, poolCategory);
  const normalizedOrganizationName = normalizeOrganizationName(record.name);
  const organizationFingerprint = sha256(normalizedOrganizationName);
  const normalizedUrl = normalizeUrl(record.website || record.listedUrl || record.finalUrl);
  return {
    ...record,
    poolCategory,
    poolSourceType,
    officialStatus: record.status === "verified_accessible" ? "official" : "unknown" as SourcePoolOfficialStatus,
    normalizedOrganizationName,
    organizationFingerprint,
    normalizedUrl,
    sourceFingerprint: sha256(`${organizationFingerprint}|${normalizedUrl}`),
    organizationType: organizationType(poolCategory),
    sourceTypeLabel: sourceTypeLabel(poolSourceType, poolCategory),
    sourceCategory: sourceCategory(poolCategory),
    discoveredFromUrl: record.sourceUrl || record.website || record.listedUrl,
  };
}
