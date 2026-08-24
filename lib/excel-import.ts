export type ExcelImportInputRow = Record<string, unknown>;

export type NormalizedExcelImportRow = {
  companyName: string;
  companyType: string;
  projectName: string;
  recruitmentType: string;
  recruitmentAudience: string;
  recruitmentBatch: string;
  graduationYear: number | null;
  degreeRequirements: string[];
  originalMajorText: string;
  normalizedMajorNames: string[];
  majorCategories: string[];
  workLocations: string[];
  publishedAt: string | null;
  startAt: string | null;
  deadline: string | null;
  announcementUrl: string | null;
  applicationUrl: string | null;
  sourceName: string;
  sourceUrl: string | null;
  sourceLevel: "A级" | "B级" | "C级" | "D级";
  timeVerificationStatus: string;
  adminNote: string;
  opportunityType: "ENTERPRISE_CAMPUS" | "CENTRAL_SOE" | "LOCAL_SOE" | "NATIONAL_CIVIL_SERVICE" | "PROVINCIAL_CIVIL_SERVICE" | "SELECTED_GRADUATE" | "PUBLIC_INSTITUTION" | "MILITARY_CIVILIAN" | "BANK_CAMPUS" | "OTHER";
  recruitmentSeason: "AUTUMN" | "SPRING" | null;
  errors: string[];
  warnings: string[];
};

const aliases = {
  companyName: ["企业名称", "公司名称", "单位名称", "企业", "company", "organization"],
  companyType: ["企业类型", "单位性质", "公司类型", "企业类别", "organizationtype"],
  projectName: ["招聘项目名称", "项目名称", "招聘名称", "招聘标题", "公告标题", "project", "title"],
  recruitmentType: ["招聘类型", "招聘类别", "招聘分类", "招聘性质", "类别", "类型", "recruitmenttype"],
  recruitmentAudience: ["招聘对象", "面向对象", "目标人群", "应聘对象", "对象", "targetaudience"],
  recruitmentBatch: ["招聘批次", "批次", "batch"],
  graduationYear: ["毕业年份", "毕业年度", "届别", "目标毕业年份", "graduationyear"],
  degreeRequirements: ["学历要求", "学历", "degree", "education"],
  originalMajorText: ["招聘专业原文", "专业要求", "招聘专业", "专业限制", "专业", "majorrequirement"],
  normalizedMajorNames: ["标准专业名称", "专业名称", "标准专业", "majors"],
  majorCategories: ["专业大类", "学科门类", "majorcategories"],
  workLocations: ["招聘地区", "工作地点", "工作城市", "地区", "地点", "locations"],
  publishedAt: ["公告发布时间", "发布日期", "发布日期", "发布时间", "publishedat"],
  startAt: ["招聘开始时间", "报名开始时间", "开始时间", "startat"],
  deadline: ["报名截止时间", "截止时间", "截止日期", "deadline"],
  officialWebsite: ["官网", "官方网站", "企业官网", "招聘官网", "官网地址", "网站链接", "招聘网站", "网站", "网址", "website", "officialwebsite", "url", "link"],
  announcementUrl: ["官方公告链接", "公告链接", "招聘公告", "公告地址", "公告url", "officialannouncementurl"],
  applicationUrl: ["官方报名链接", "报名链接", "招聘链接", "招聘地址", "投递链接", "投递地址", "应聘链接", "职位链接", "官方招聘链接", "officialapplicationurl", "joburl"],
  sourceName: ["来源名称", "数据源名称", "信息来源", "数据来源", "来源", "sourcename"],
  sourceUrl: ["来源链接", "数据源链接", "信息来源链接", "来源网址", "网站链接", "sourceurl"],
  sourceLevel: ["来源级别", "级别", "sourcelevel"],
  timeVerificationStatus: ["时间核验状态", "时间状态", "timeverificationstatus"],
  adminNote: ["管理员备注", "备注", "备注说明", "note"],
} as const;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_（）()：:]+/g, "");
}
function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function pick(row: ExcelImportInputRow, names: readonly string[]) {
  const normalizedNames = new Set(names.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedNames.has(normalizeHeader(key))) return cellText(value);
  }
  return "";
}

function splitValues(value: string) {
  return Array.from(new Set(value.split(/[、,，;；|/\n]+/).map((item) => item.trim()).filter(Boolean)));
}

function validCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatDateParts(year: number, month: number, day: number) {
  if (!validCalendarDate(year, month, day)) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function normalizeExcelDate(value: string) {
  const text = value.trim();
  if (!text) return null;
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
    return formatDateParts(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  const chinese = text.match(/^(\d{4})[年/.\-](\d{1,2})[月/.\-](\d{1,2})(?:日)?/);
  if (chinese) return formatDateParts(Number(chinese[1]), Number(chinese[2]), Number(chinese[3]));
  const western = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (western) return formatDateParts(Number(western[3]), Number(western[1]), Number(western[2]));
  return null;
}

function normalizeUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function detectOpportunityType(text: string): NormalizedExcelImportRow["opportunityType"] {
  if (/军队文职/.test(text)) return "MILITARY_CIVILIAN";
  if (/事业单位|事业编/.test(text)) return "PUBLIC_INSTITUTION";
  if (/选调/.test(text)) return "SELECTED_GRADUATE";
  if (/国考|国家公务员/.test(text)) return "NATIONAL_CIVIL_SERVICE";
  if (/省考|公务员招录/.test(text)) return "PROVINCIAL_CIVIL_SERVICE";
  if (/银行/.test(text)) return "BANK_CAMPUS";
  if (/地方国企/.test(text)) return "LOCAL_SOE";
  if (/央企/.test(text)) return "CENTRAL_SOE";
  return "ENTERPRISE_CAMPUS";
}

function detectSeason(text: string): NormalizedExcelImportRow["recruitmentSeason"] {
  if (/春招|春季/.test(text)) return "SPRING";
  if (/秋招|秋季/.test(text)) return "AUTUMN";
  return null;
}

function normalizeSourceLevel(value: string) {
  const match = value.toUpperCase().match(/[ABCD]/)?.[0];
  return match ? `${match}级` as NormalizedExcelImportRow["sourceLevel"] : null;
}

export function normalizeExcelImportRow(row: ExcelImportInputRow): NormalizedExcelImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const companyName = pick(row, aliases.companyName);
  const companyType = pick(row, aliases.companyType);
  const projectNameValue = pick(row, aliases.projectName);
  const projectName = projectNameValue || "待审核补充招聘项目";
  const recruitmentType = pick(row, aliases.recruitmentType);
  const recruitmentAudience = pick(row, aliases.recruitmentAudience);
  const batchValue = pick(row, aliases.recruitmentBatch);
  const yearValue = pick(row, aliases.graduationYear);
  const originalMajorText = pick(row, aliases.originalMajorText);
  const announcementValue = pick(row, aliases.announcementUrl);
  const applicationValue = pick(row, aliases.applicationUrl);
  const officialWebsiteValue = pick(row, aliases.officialWebsite);
  const sourceUrlValue = pick(row, aliases.sourceUrl);
  const sourceLevelValue = pick(row, aliases.sourceLevel);
  const publishedValue = pick(row, aliases.publishedAt);
  const startValue = pick(row, aliases.startAt);
  const deadlineValue = pick(row, aliases.deadline);

  if (!companyName) errors.push("缺少企业名称");
  if (!projectNameValue) warnings.push("招聘项目名称待管理员补充");

  const officialWebsite = normalizeUrl(officialWebsiteValue);
  const explicitAnnouncementUrl = normalizeUrl(announcementValue);
  const applicationUrl = normalizeUrl(applicationValue);
  const explicitSourceUrl = normalizeUrl(sourceUrlValue);
  const announcementUrl = explicitAnnouncementUrl ?? officialWebsite ?? explicitSourceUrl;
  if (announcementValue && !explicitAnnouncementUrl) errors.push("官方公告链接格式无效");
  if (applicationValue && !applicationUrl) errors.push("官方报名链接格式无效");
  if (officialWebsiteValue && !officialWebsite) errors.push("官网链接格式无效");
  if (sourceUrlValue && !explicitSourceUrl) errors.push("来源链接格式无效");
  if (!announcementUrl && !applicationUrl) errors.push("缺少网站链接");

  const normalizedMajorText = originalMajorText || "专业要求待管理员补充";
  if (!originalMajorText) warnings.push("招聘专业原文未填写，待管理员审核时补充");

  const yearMatch = yearValue.match(/20\d{2}/)?.[0];
  const graduationYear = yearMatch ? Number(yearMatch) : null;
  if (yearValue && !graduationYear) errors.push("毕业年份格式无效");
  if (!graduationYear) warnings.push("毕业年份待管理员补充");

  const recruitmentBatch = batchValue || "未标注批次";
  if (!batchValue) warnings.push("招聘批次待管理员补充");

  const publishedAt = normalizeExcelDate(publishedValue);
  const startAt = normalizeExcelDate(startValue);
  const deadline = normalizeExcelDate(deadlineValue);
  if (publishedValue && !publishedAt) errors.push("公告发布时间格式无效");
  if (startValue && !startAt) errors.push("招聘开始时间格式无效");
  if (deadlineValue && !deadline) errors.push("报名截止时间格式无效");
  if (startAt && deadline && deadline < startAt) errors.push("报名截止时间早于招聘开始时间");

  const sourceLevel = normalizeSourceLevel(sourceLevelValue) ?? "C级";
  if (!sourceLevelValue) warnings.push("来源级别未填写，暂按C级进入人工审核");
  else if (!normalizeSourceLevel(sourceLevelValue)) errors.push("来源级别必须为A、B、C或D");

  const combinedText = [companyName, companyType, projectName, recruitmentType, recruitmentAudience, recruitmentBatch, pick(row, aliases.adminNote)].join(" ");
  const sourceUrl = explicitSourceUrl ?? announcementUrl ?? applicationUrl;
  const timeVerificationStatus = pick(row, aliases.timeVerificationStatus) || "时间待确认";
  if (!pick(row, aliases.timeVerificationStatus)) warnings.push("时间核验状态待管理员确认");

  return {
    companyName,
    companyType,
    projectName,
    recruitmentType,
    recruitmentAudience,
    recruitmentBatch,
    graduationYear,
    degreeRequirements: splitValues(pick(row, aliases.degreeRequirements)),
    originalMajorText: normalizedMajorText,
    normalizedMajorNames: splitValues(pick(row, aliases.normalizedMajorNames)),
    majorCategories: splitValues(pick(row, aliases.majorCategories)),
    workLocations: splitValues(pick(row, aliases.workLocations)),
    publishedAt,
    startAt,
    deadline,
    announcementUrl,
    applicationUrl,
    sourceName: pick(row, aliases.sourceName) || `${companyName || "未匹配企业"} Excel导入来源`,
    sourceUrl,
    sourceLevel,
    timeVerificationStatus,
    adminNote: pick(row, aliases.adminNote),
    opportunityType: detectOpportunityType(combinedText),
    recruitmentSeason: detectSeason(combinedText),
    errors,
    warnings,
  };
}

export function excelImportDedupeKey(row: NormalizedExcelImportRow, organizationId?: string) {
  const compact = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "");
  return [organizationId ?? compact(row.companyName), compact(row.projectName), row.graduationYear ?? "unknown", compact(row.recruitmentBatch), compact(row.sourceUrl ?? row.announcementUrl ?? row.applicationUrl ?? "")].join(":");
}
