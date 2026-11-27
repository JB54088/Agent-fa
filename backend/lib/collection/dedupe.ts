import type { NormalizedOpportunity } from "./types";

export type DuplicateClassification = "EXACT_DUPLICATE" | "HIGHLY_LIKELY_DUPLICATE" | "POSSIBLE_DUPLICATE" | "NOT_DUPLICATE";

export type DedupeCandidate = Pick<NormalizedOpportunity, "title" | "recruitmentYear" | "recruitmentSeason" | "batchName" | "targetGraduationYears" | "officialAnnouncementUrl" | "officialApplicationUrl"> & { organizationId: string | null; publishedAt?: string | null; contentHash?: string | null };

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[\s\-—_·:：，。、“”‘’()（）]/g, "").replace(/20\d{2}/g, "YEAR");
}

export function buildDedupeFingerprint(candidate: DedupeCandidate) {
  return [candidate.organizationId ?? "UNKNOWN_ORG", candidate.recruitmentYear ?? "UNKNOWN_YEAR", candidate.recruitmentSeason ?? "UNKNOWN_SEASON", candidate.batchName ?? "UNKNOWN_BATCH", [...candidate.targetGraduationYears].sort().join("."), candidate.officialAnnouncementUrl ?? "NO_ANNOUNCEMENT", candidate.officialApplicationUrl ?? "NO_APPLICATION", normalizeTitle(candidate.title), candidate.publishedAt ?? "NO_PUBLISHED_AT", candidate.contentHash ?? "NO_HASH"].join("|");
}

export function classifyDuplicate(candidate: DedupeCandidate, existing: DedupeCandidate): DuplicateClassification {
  const sameOrganization = candidate.organizationId !== null && candidate.organizationId === existing.organizationId;
  const sameYear = candidate.recruitmentYear !== null && candidate.recruitmentYear === existing.recruitmentYear;
  const sameSeason = candidate.recruitmentSeason !== null && candidate.recruitmentSeason === existing.recruitmentSeason;
  const sameBatch = candidate.batchName !== null && candidate.batchName === existing.batchName;
  const sameTargetYears = candidate.targetGraduationYears.length > 0 && candidate.targetGraduationYears.join(",") === existing.targetGraduationYears.join(",");
  const sameOfficialUrl = Boolean(candidate.officialAnnouncementUrl && candidate.officialAnnouncementUrl === existing.officialAnnouncementUrl) || Boolean(candidate.officialApplicationUrl && candidate.officialApplicationUrl === existing.officialApplicationUrl);
  const sameTitle = normalizeTitle(candidate.title) === normalizeTitle(existing.title);
  const sameHash = Boolean(candidate.contentHash && candidate.contentHash === existing.contentHash);
  if (sameOrganization && sameYear && sameSeason && sameBatch && sameOfficialUrl && (sameHash || sameTitle)) return "EXACT_DUPLICATE";
  const score = [sameOrganization, sameYear, sameSeason, sameBatch, sameTargetYears, sameOfficialUrl, sameTitle, sameHash].filter(Boolean).length;
  if (score >= 6) return "HIGHLY_LIKELY_DUPLICATE";
  if (score >= 4) return "POSSIBLE_DUPLICATE";
  return "NOT_DUPLICATE";
}
