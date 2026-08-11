export type NationalSourceCategory =
  | "NATIONAL_CIVIL_SERVICE"
  | "PROVINCIAL_CIVIL_SERVICE"
  | "CENTRAL_SOE"
  | "LOCAL_SOE"
  | "ENTERPRISE_DISCOVERY";

export type NationalSourceFrequency = "DAILY" | "EVERY_7_DAYS";

export type NationalSourceSeed = {
  id: string;
  name: string;
  category: NationalSourceCategory;
  scope: "NATIONAL" | "PROVINCE" | "REGION";
  regionCode: string | null;
  regionName: string | null;
  requiredOfficialRoles: string[];
  sourceUrl: null;
  sourceDomain: null;
  normalFrequency: NationalSourceFrequency;
  activeFrequency: "DAILY";
  discoveryStatus: "NEEDS_REVIEW";
  automationAllowed: false;
  notes: string;
};

type Province = { code: string; name: string };

const provinces: Province[] = [
  ["CN-BJ", "北京"], ["CN-TJ", "天津"], ["CN-HE", "河北"], ["CN-SX", "山西"], ["CN-NM", "内蒙古"],
  ["CN-LN", "辽宁"], ["CN-JL", "吉林"], ["CN-HL", "黑龙江"], ["CN-SH", "上海"], ["CN-JS", "江苏"],
  ["CN-ZJ", "浙江"], ["CN-AH", "安徽"], ["CN-FJ", "福建"], ["CN-JX", "江西"], ["CN-SD", "山东"],
  ["CN-HA", "河南"], ["CN-HB", "湖北"], ["CN-HN", "湖南"], ["CN-GD", "广东"], ["CN-GX", "广西"],
  ["CN-HI", "海南"], ["CN-CQ", "重庆"], ["CN-SC", "四川"], ["CN-GZ", "贵州"], ["CN-YN", "云南"],
  ["CN-XZ", "西藏"], ["CN-SN", "陕西"], ["CN-GS", "甘肃"], ["CN-QH", "青海"], ["CN-NX", "宁夏"],
  ["CN-XJ", "新疆"],
].map(([code, name]) => ({ code, name }));

const priorityLocalRegions: Province[] = [
  { code: "CN-BJ", name: "北京" },
  { code: "CN-SH", name: "上海" },
  { code: "CN-GD", name: "广东" },
  { code: "CN-JS", name: "江苏" },
  { code: "CN-ZJ", name: "浙江" },
  { code: "CN-SD", name: "山东" },
  { code: "CN-SC", name: "四川" },
  { code: "CN-HB", name: "湖北" },
  { code: "CN-FJ", name: "福建" },
  { code: "CN-SN", name: "陕西" },
];

const needsReviewNote = "全国目录已建立；官方网址、robots、服务条款、验证码和允许路径尚未逐条完成人工核验，暂不自动采集。";

function provincialExamSource(province: Province): NationalSourceSeed {
  return {
    id: `provincial-civil-service-${province.code.toLowerCase()}`,
    name: `${province.name}省级公务员考试官方来源档案`,
    category: "PROVINCIAL_CIVIL_SERVICE",
    scope: "PROVINCE",
    regionCode: province.code,
    regionName: province.name,
    requiredOfficialRoles: ["公务员主管部门", "人事考试网站", "年度招录专题网站"],
    sourceUrl: null,
    sourceDomain: null,
    normalFrequency: "EVERY_7_DAYS",
    activeFrequency: "DAILY",
    discoveryStatus: "NEEDS_REVIEW",
    automationAllowed: false,
    notes: needsReviewNote,
  };
}

export const nationalSourceDirectory: NationalSourceSeed[] = [
  {
    id: "national-civil-service-official",
    name: "国家公务员考试官方来源档案",
    category: "NATIONAL_CIVIL_SERVICE",
    scope: "NATIONAL",
    regionCode: null,
    regionName: "全国",
    requiredOfficialRoles: ["国家公务员局/中央机关招录公告", "职位表", "报名与考试专题页"],
    sourceUrl: null,
    sourceDomain: null,
    normalFrequency: "EVERY_7_DAYS",
    activeFrequency: "DAILY",
    discoveryStatus: "NEEDS_REVIEW",
    automationAllowed: false,
    notes: needsReviewNote,
  },
  {
    id: "sasac-central-soe-catalog",
    name: "国务院国资委中央企业名录同步入口",
    category: "CENTRAL_SOE",
    scope: "NATIONAL",
    regionCode: null,
    regionName: "全国",
    requiredOfficialRoles: ["中央企业名录", "集团官网", "下属单位官网招聘栏目"],
    sourceUrl: null,
    sourceDomain: null,
    normalFrequency: "EVERY_7_DAYS",
    activeFrequency: "DAILY",
    discoveryStatus: "NEEDS_REVIEW",
    automationAllowed: false,
    notes: needsReviewNote,
  },
  {
    id: "enterprise-source-discovery",
    name: "企业招聘专题与官方招聘子域名发现入口",
    category: "ENTERPRISE_DISCOVERY",
    scope: "NATIONAL",
    regionCode: null,
    regionName: "全国",
    requiredOfficialRoles: ["企业官网招聘栏目", "校园招聘专题页", "官方招聘子域名"],
    sourceUrl: null,
    sourceDomain: null,
    normalFrequency: "EVERY_7_DAYS",
    activeFrequency: "DAILY",
    discoveryStatus: "NEEDS_REVIEW",
    automationAllowed: false,
    notes: "只记录发现线索，不直接加入自动抓取；发现后必须经过管理员核验。",
  },
  ...provinces.map(provincialExamSource),
  ...priorityLocalRegions.map((region) => ({
    id: `local-soe-${region.code.toLowerCase()}`,
    name: `${region.name}地方国企公开招聘来源档案`,
    category: "LOCAL_SOE" as const,
    scope: "REGION" as const,
    regionCode: region.code,
    regionName: region.name,
    requiredOfficialRoles: ["省级国资委", "市级国资委", "地方国企官网/官方招聘平台"],
    sourceUrl: null,
    sourceDomain: null,
    normalFrequency: "EVERY_7_DAYS" as const,
    activeFrequency: "DAILY" as const,
    discoveryStatus: "NEEDS_REVIEW" as const,
    automationAllowed: false as const,
    notes: needsReviewNote,
  })),
  {
    id: "local-soe-hong-kong",
    name: "香港面向内地高校毕业生的公开招聘来源档案",
    category: "LOCAL_SOE",
    scope: "REGION",
    regionCode: "HK",
    regionName: "香港",
    requiredOfficialRoles: ["政府或公共机构官网", "企业官方招聘页"],
    sourceUrl: null,
    sourceDomain: null,
    normalFrequency: "EVERY_7_DAYS",
    activeFrequency: "DAILY",
    discoveryStatus: "NEEDS_REVIEW",
    automationAllowed: false,
    notes: "仅收录明确面向内地高校毕业生的公开机会；官方网址待人工核验。",
  },
  {
    id: "local-soe-macau",
    name: "澳门面向内地高校毕业生的公开招聘来源档案",
    category: "LOCAL_SOE",
    scope: "REGION",
    regionCode: "MO",
    regionName: "澳门",
    requiredOfficialRoles: ["政府或公共机构官网", "企业官方招聘页"],
    sourceUrl: null,
    sourceDomain: null,
    normalFrequency: "EVERY_7_DAYS",
    activeFrequency: "DAILY",
    discoveryStatus: "NEEDS_REVIEW",
    automationAllowed: false,
    notes: "仅收录明确面向内地高校毕业生的公开机会；官方网址待人工核验。",
  },
];

export const nationalSourceDirectorySummary = {
  total: nationalSourceDirectory.length,
  provincialCivilService: nationalSourceDirectory.filter((source) => source.category === "PROVINCIAL_CIVIL_SERVICE").length,
  centralSoe: nationalSourceDirectory.filter((source) => source.category === "CENTRAL_SOE").length,
  localSoe: nationalSourceDirectory.filter((source) => source.category === "LOCAL_SOE").length,
  needsReview: nationalSourceDirectory.filter((source) => source.discoveryStatus === "NEEDS_REVIEW").length,
  autoAllowed: nationalSourceDirectory.filter((source) => source.automationAllowed).length,
};

if (nationalSourceDirectorySummary.provincialCivilService !== 31) {
  throw new Error(`Expected 31 provincial civil-service source profiles, received ${nationalSourceDirectorySummary.provincialCivilService}`);
}
