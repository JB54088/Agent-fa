import type { NormalizedOpportunity, RawRecruitmentRecord } from "./types";

const datePattern = /(20\d{2})[年\/.\-](\d{1,2})[月\/.\-](\d{1,2})/;

export function parseDateFromText(text: string) {
  const match = text.match(datePattern);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

export function detectDeadlineType(text: string): NormalizedOpportunity["deadlineType"] {
  if (/招满即止|额满即止|岗位招满/.test(text)) return "UNTIL_FILLED";
  if (/长期招聘|常年招聘|全年招聘/.test(text)) return "LONG_TERM";
  if (/预计|拟于|大约/.test(text) && /截止|结束|报名/.test(text)) return "ESTIMATED";
  if (/时间另行通知|截止时间未公布|报名时间待定|待通知/.test(text)) return "NOT_ANNOUNCED";
  if (/截止|报名结束|报名时间/.test(text) && parseDateFromText(text)) return "FIXED_DATE";
  return "NOT_ANNOUNCED";
}

export function normalizeRecruitmentRecord(record: RawRecruitmentRecord, organizationName: string | null): NormalizedOpportunity {
  const deadlineType = detectDeadlineType(record.text);
  return {
    organizationName,
    title: record.title.trim(),
    recruitmentYear: Number(record.title.match(/20\d{2}/)?.[0] ?? record.text.match(/20\d{2}/)?.[0] ?? 0) || null,
    recruitmentSeason: /春招|春季/.test(record.title) ? "SPRING" : /秋招|秋季/.test(record.title) ? "AUTUMN" : null,
    batchName: /提前批/.test(record.title) ? "提前批" : /补录/.test(record.title) ? "补录" : null,
    targetGraduationYears: Array.from(record.text.matchAll(/(20\d{2})届/g), (match) => Number(match[1])),
    description: record.text.slice(0, 500),
    educationRequirements: Array.from(new Set(record.text.match(/本科|硕士|博士/g) ?? [])),
    majorRequirementText: record.text.match(/专业[^。；\n]{0,80}/)?.[0] ?? null,
    unlimitedMajor: /不限专业|专业不限/.test(record.text) ? true : null,
    acceptsRelatedMajors: /相关专业|相近专业/.test(record.text) ? true : null,
    workLocations: [],
    recruitmentNumber: null,
    officialAnnouncementUrl: record.sourceUrl,
    officialApplicationUrl: null,
    deadlineType,
    dataCredibility: "待评估",
    needsManualReview: true,
    originalText: record.text,
  };
}
