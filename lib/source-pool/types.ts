export type SourcePoolCategory =
  | "big_company"
  | "central_soe"
  | "local_soe"
  | "military_civilian"
  | "provincial_civil_service"
  | "national_civil_service";

export type SourcePoolOfficialStatus = "official" | "likely_official" | "unknown" | "third_party";

export type SourcePoolSourceType =
  | "official_homepage"
  | "official_career_site"
  | "official_recruitment_page"
  | "government_site"
  | "exam_site"
  | "recruitment_platform"
  | "other";

export type SourcePoolImportRecord = {
  category: string;
  sourceType: string;
  name: string;
  region: string | null;
  website: string | null;
  listedUrl: string | null;
  finalUrl: string | null;
  pageTitle: string | null;
  verifiedAt: string | null;
  sourceUrl: string | null;
  status: string;
  error?: string | null;
};

export type NormalizedSourcePoolRecord = SourcePoolImportRecord & {
  poolCategory: SourcePoolCategory;
  poolSourceType: SourcePoolSourceType;
  officialStatus: SourcePoolOfficialStatus;
  normalizedOrganizationName: string;
  organizationFingerprint: string;
  normalizedUrl: string;
  sourceFingerprint: string;
  organizationType: string;
  sourceTypeLabel: "企业官网" | "招聘官网" | "政府官网";
  sourceCategory: "ENTERPRISE" | "CENTRAL_SOE" | "LOCAL_SOE" | "NATIONAL_CIVIL_SERVICE" | "PROVINCIAL_CIVIL_SERVICE";
  discoveredFromUrl: string | null;
};
