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
  sourceUrl: string | null;
  sourceDomain: string | null;
  normalFrequency: NationalSourceFrequency;
  activeFrequency: "DAILY";
  discoveryStatus: "NEEDS_REVIEW" | "VERIFIED";
  automationAllowed: false;
  lastVerifiedAt: string | null;
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
const verifiedAt = "2026-08-11";
const verifiedNote = "官方入口已核验（2026-08-11）；robots、服务条款、验证码和允许路径尚未逐条完成人工核验，暂不自动采集。";

function provincialExamSource(province: Province): NationalSourceSeed {
  return {
    id: `provincial-civil-service-${province.code.toLowerCase()}`,
    name: `${province.name}公务员考试官方来源档案`,
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
    lastVerifiedAt: null,
    notes: needsReviewNote,
  };
}

const baseNationalSourceDirectory: NationalSourceSeed[] = [
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
    lastVerifiedAt: null,
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
    lastVerifiedAt: null,
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
    lastVerifiedAt: null,
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
    lastVerifiedAt: null,
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
    lastVerifiedAt: null,
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
    lastVerifiedAt: null,
    notes: "仅收录明确面向内地高校毕业生的公开机会；官方网址待人工核验。",
  },
];

const verifiedSourceOverrides: Record<string, Pick<NationalSourceSeed, "sourceUrl" | "sourceDomain" | "discoveryStatus" | "lastVerifiedAt" | "notes">> = {
  "national-civil-service-official": {
    sourceUrl: "https://www.scs.gov.cn/",
    sourceDomain: "www.scs.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 2026年度报名专题入口由国家公务员局公告另行发布。`,
  },
  "sasac-central-soe-catalog": {
    sourceUrl: "https://wap.sasac.gov.cn/n2588045/n27271785/n27271792/c14159097/content.html",
    sourceDomain: "wap.sasac.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对国务院国资委“央企名录”页面。`,
  },
  "provincial-civil-service-cn-bj": {
    sourceUrl: "https://www.beijing.gov.cn/gongkai/rsxx/gwyzk/index.html",
    sourceDomain: "www.beijing.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对北京市人民政府“公务员招考”栏目。`,
  },
  "provincial-civil-service-cn-tj": {
    sourceUrl: "https://www.tj.gov.cn/zwgk/zfxxgkzl/fdzdgknr/zkly/",
    sourceDomain: "www.tj.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对天津政务网“招考录用”栏目。`,
  },
  "provincial-civil-service-cn-he": {
    sourceUrl: "https://www.hebpta.com.cn/",
    sourceDomain: "www.hebpta.com.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 官方公告明确指向河北省人事考试网。`,
  },
  "provincial-civil-service-cn-sx": {
    sourceUrl: "https://rst.shanxi.gov.cn/",
    sourceDomain: "rst.shanxi.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已按山西省官方公告核对省人力资源和社会保障厅入口。`,
  },
  "provincial-civil-service-cn-nm": {
    sourceUrl: "https://www.impta.com.cn/",
    sourceDomain: "www.impta.com.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 官方公告明确指向内蒙古人事考试网。`,
  },
  "provincial-civil-service-cn-ln": {
    sourceUrl: "https://www.lnrsks.com/",
    sourceDomain: "www.lnrsks.com",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已按辽宁省公务员局公告核对辽宁人事考试网。`,
  },
  "provincial-civil-service-cn-jl": {
    sourceUrl: "https://hrss.jl.gov.cn/",
    sourceDomain: "hrss.jl.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对吉林省人力资源和社会保障厅官网公告。`,
  },
  "provincial-civil-service-cn-hl": {
    sourceUrl: "https://www.hljsgwy.org.cn/",
    sourceDomain: "www.hljsgwy.org.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对黑龙江省政府发布的公务员考试提示及考试网入口。`,
  },
  "provincial-civil-service-cn-sh": {
    sourceUrl: "https://bm.shacs.gov.cn/zlxt",
    sourceDomain: "bm.shacs.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对上海市公务员考试报名系统。`,
  },
  "provincial-civil-service-cn-js": {
    sourceUrl: "https://jshrss.jiangsu.gov.cn/col/col57253/index.html",
    sourceDomain: "jshrss.jiangsu.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对江苏省人力资源和社会保障厅公告及江苏人事考试网栏目。`,
  },
  "provincial-civil-service-cn-zj": {
    sourceUrl: "https://gwy.zjks.gov.cn/",
    sourceDomain: "gwy.zjks.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对浙江省公务员考试录用网。`,
  },
  "provincial-civil-service-cn-ah": {
    sourceUrl: "https://www.apta.gov.cn/",
    sourceDomain: "www.apta.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 官方招录指南明确指向安徽省人事考试网。`,
  },
  "provincial-civil-service-cn-fj": {
    sourceUrl: "http://gwykl.fujian.gov.cn",
    sourceDomain: "gwykl.fujian.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 福建省官方公告明确指向福建省公务员考试录用网；该入口当前由官方公告以HTTP发布，暂不自动采集。`,
  },
  "provincial-civil-service-cn-jx": {
    sourceUrl: "http://www.jxpta.com/",
    sourceDomain: "www.jxpta.com",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 江西省官方公告明确指向江西人事考试网；暂不自动采集。`,
  },
  "provincial-civil-service-cn-sd": {
    sourceUrl: "https://gwy.sdrsks.org.cn/skbm2026.html",
    sourceDomain: "gwy.sdrsks.org.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对山东省官方公告中的2026年度公务员报名平台。`,
  },
  "provincial-civil-service-cn-ha": {
    sourceUrl: "https://www.hnrsks.com/",
    sourceDomain: "www.hnrsks.com",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已按河南省人事考试中心公开信息核对河南人事考试网。`,
  },
  "provincial-civil-service-cn-hb": {
    sourceUrl: "https://rst.hubei.gov.cn/hbrsksw/",
    sourceDomain: "rst.hubei.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对湖北省人事考试网公务员考试栏目。`,
  },
  "provincial-civil-service-cn-hn": {
    sourceUrl: "https://rst.hunan.gov.cn/rst/hnrsksw/c103103/gwy2026/rskswlist.html",
    sourceDomain: "rst.hunan.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对湖南人事考试网2026年公务员考试栏目。`,
  },
  "provincial-civil-service-cn-gd": {
    sourceUrl: "https://www.gdzz.gov.cn/",
    sourceDomain: "www.gdzz.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对广东省委组织部公告及广东组织工作网。`,
  },
  "provincial-civil-service-cn-gx": {
    sourceUrl: "https://www.gxpta.com.cn/",
    sourceDomain: "www.gxpta.com.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 广西官方公告明确指向广西人事考试网。`,
  },
  "provincial-civil-service-cn-hi": {
    sourceUrl: "https://ea.hainan.gov.cn/ywdt/gwyks/",
    sourceDomain: "ea.hainan.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对海南省考试局公务员考试栏目。`,
  },
  "provincial-civil-service-cn-cq": {
    sourceUrl: "https://rlsbj.cq.gov.cn/ztzl/zqs2020ndkslygwyzl/",
    sourceDomain: "rlsbj.cq.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对重庆市人力资源和社会保障局2026年公务员专题。`,
  },
  "provincial-civil-service-cn-sc": {
    sourceUrl: "https://www.scpta.com.cn/front/Special/Info/85887d50aadf43f491088f4a9106c647",
    sourceDomain: "www.scpta.com.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已按四川省官方公告核对2026年度公务员专题网站。`,
  },
  "provincial-civil-service-cn-gz": {
    sourceUrl: "https://www.gzrsks.com.cn/",
    sourceDomain: "www.gzrsks.com.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 贵州省官方公告明确指向贵州人事考试信息网。`,
  },
  "provincial-civil-service-cn-yn": {
    sourceUrl: "https://ylxf.1237125.cn/TopicWeb/ynskslygwy/index.html",
    sourceDomain: "ylxf.1237125.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对云南省官方考录专题网页。`,
  },
  "provincial-civil-service-cn-xz": {
    sourceUrl: "https://hrss.xizang.gov.cn/xwzx/tzgg/202512/t20251202_512168.html",
    sourceDomain: "hrss.xizang.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对西藏自治区人力资源和社会保障厅发布的2026年高校毕业生公开考录公务员公告。`,
  },
  "provincial-civil-service-cn-sn": {
    sourceUrl: "https://www.sxrsks.cn/",
    sourceDomain: "www.sxrsks.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对陕西省人民政府发布的2026年公务员公告及陕西人事考试网。`,
  },
  "provincial-civil-service-cn-gs": {
    sourceUrl: "https://www.gszg.gov.cn/",
    sourceDomain: "www.gszg.gov.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对甘肃组工网2026年度公务员招录公告。`,
  },
  "provincial-civil-service-cn-qh": {
    sourceUrl: "https://www.qhpta.com/",
    sourceDomain: "www.qhpta.com",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 青海省官方公告明确指向青海省人事考试信息网。`,
  },
  "provincial-civil-service-cn-nx": {
    sourceUrl: "https://www.nxpta.com/",
    sourceDomain: "www.nxpta.com",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已按宁夏自治区党委组织部公告核对宁夏人事考试中心网。`,
  },
  "provincial-civil-service-cn-xj": {
    sourceUrl: "https://www.xjrsks.com.cn/",
    sourceDomain: "www.xjrsks.com.cn",
    discoveryStatus: "VERIFIED",
    lastVerifiedAt: verifiedAt,
    notes: `${verifiedNote} 已核对新疆维吾尔自治区人力资源和社会保障厅公告及新疆人事考试中心网站。`,
  },
};

export const nationalSourceDirectory: NationalSourceSeed[] = baseNationalSourceDirectory.map((source) => ({
  ...source,
  ...(verifiedSourceOverrides[source.id] ?? {}),
}));

export const nationalSourceDirectorySummary = {
  total: nationalSourceDirectory.length,
  provincialCivilService: nationalSourceDirectory.filter((source) => source.category === "PROVINCIAL_CIVIL_SERVICE").length,
  centralSoe: nationalSourceDirectory.filter((source) => source.category === "CENTRAL_SOE").length,
  localSoe: nationalSourceDirectory.filter((source) => source.category === "LOCAL_SOE").length,
  verified: nationalSourceDirectory.filter((source) => source.discoveryStatus === "VERIFIED").length,
  needsReview: nationalSourceDirectory.filter((source) => source.discoveryStatus === "NEEDS_REVIEW").length,
  autoAllowed: nationalSourceDirectory.filter((source) => source.automationAllowed).length,
};

if (nationalSourceDirectorySummary.provincialCivilService !== 31) {
  throw new Error(`Expected 31 provincial civil-service source profiles, received ${nationalSourceDirectorySummary.provincialCivilService}`);
}
