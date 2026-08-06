import { organizationsSeed, type OrganizationPriority } from "./organizations.ts";

export type SourceDiscoveryStatus = "AUTO_ALLOWED" | "ATTACHMENT_ONLY" | "MANUAL_ONLY" | "NEEDS_REVIEW" | "BLOCKED" | "INACTIVE" | "UNKNOWN";

export type DataSourceSeed = {
  organizationName: string;
  sourceName: string;
  sourceDomain: string | null;
  sourceUrl: string | null;
  sourceType: "招聘官网" | "企业官网" | null;
  officialLevel: "A级";
  sourceStatus: SourceDiscoveryStatus;
  crawlerStrategy: "MANUAL_SOURCE_AUDIT" | "HTML_LIST" | "ATTACHMENT_ONLY";
  listPageUrl: string | null;
  detailUrlPattern: string | null;
  apiUrl: string | null;
  rssUrl: string | null;
  robotsUrl: string | null;
  termsUrl: string | null;
  requiresJavascript: boolean | null;
  requiresLogin: boolean | null;
  hasCaptcha: boolean | null;
  recommendedFrequency: "P0_PEAK_DAILY" | "P1_EVERY_2_3_DAYS" | "P2_WEEKLY";
  automationAllowed: false;
  priority: OrganizationPriority;
  officialConfirmed: false;
  lastVerifiedAt: null;
  notes: string;
};

type SourceOverride = Partial<Omit<DataSourceSeed, "organizationName" | "priority" | "recommendedFrequency">>;

// These entries were opened and matched to the target unit or its official recruitment announcement.
// They remain NEEDS_REVIEW until robots.txt, terms, login/captcha and allowed paths are recorded.
const confirmedSourceOverrides: Record<string, SourceOverride> = {
  "国家电网有限公司": {
    sourceName: "国家电网人力资源招聘平台（待复核）",
    sourceDomain: "zhaopin.sgcc.com.cn",
    sourceUrl: "https://zhaopin.sgcc.com.cn/",
    sourceType: "招聘官网",
    notes: "官方招聘公告引用该招聘平台；直连返回412，需人工浏览器复核，暂不自动采集。",
  },
  "中国南方电网有限责任公司": {
    sourceName: "南方电网公司员工招聘系统（待复核）",
    sourceDomain: "zhaopin.csg.cn",
    sourceUrl: "https://zhaopin.csg.cn/",
    sourceType: "招聘官网",
    requiresJavascript: true,
    notes: "官方招聘系统已打开；页面依赖JavaScript，robots/条款/验证码与允许路径仍待人工核验。",
  },
  "中国移动通信集团有限公司": {
    sourceName: "中国移动招聘网站（待复核）",
    sourceDomain: "job.10086.cn",
    sourceUrl: "https://job.10086.cn/",
    listPageUrl: "https://job.10086.cn/personal/campus/campus_job_list.html",
    sourceType: "招聘官网",
    notes: "官方招聘网站及校园招聘列表页已打开；登录边界、robots/条款与允许路径仍待人工核验。",
  },
  "中国电信集团有限公司": {
    sourceName: "中国电信招聘网站（待复核）",
    sourceDomain: "job.chinatelecom.com.cn",
    sourceUrl: "https://job.chinatelecom.com.cn/wt/TELE/web/index",
    sourceType: "招聘官网",
    notes: "官方招聘入口已定位；当前抓取文本为空，需人工浏览器复核后再决定采集方式。",
  },
  "中国联合网络通信集团有限公司": {
    sourceName: "中国联通招聘入口（待复核）",
    sourceDomain: "zglt.zhaopin.com",
    sourceUrl: "https://zglt.zhaopin.com/home/index.html",
    sourceType: "招聘官网",
    notes: "中国联通官网招聘栏目指向该入口；页面内容需人工浏览器复核，暂不自动采集。",
  },
  "中国石油化工集团有限公司": {
    sourceName: "中国石化人才招聘网（待复核）",
    sourceDomain: "job.sinopec.com",
    sourceUrl: "https://job.sinopec.com/",
    sourceType: "招聘官网",
    notes: "中国石化集团官方公告明确该站为毕业生招聘唯一渠道；直连超时，需人工复核可访问性。",
  },
  "中国海洋石油集团有限公司": {
    sourceName: "中国海油校园招聘（待复核）",
    sourceDomain: "cnooc.zhaopin.com",
    sourceUrl: "https://cnooc.zhaopin.com/notice/index.html",
    listPageUrl: "https://cnooc.zhaopin.com/xc/index.html",
    sourceType: "招聘官网",
    notes: "中国海油2026届校园招聘页面已打开；页面正文依赖前端渲染，robots/条款/允许路径仍待人工核验。",
  },
  "国家石油天然气管网集团有限公司": {
    sourceName: "国家管网集团招聘平台（待复核）",
    sourceDomain: "pipechina.hotjob.cn",
    sourceUrl: "https://pipechina.hotjob.cn/",
    sourceType: "招聘官网",
    requiresJavascript: true,
    notes: "国家管网官方招聘公告给出该报名平台，直连跳转至wecruit.hotjob.cn并提示需要JavaScript，暂不自动采集。",
  },
};

function frequencyFor(priority: OrganizationPriority): DataSourceSeed["recommendedFrequency"] {
  if (priority === "P0") return "P0_PEAK_DAILY";
  if (priority === "P1") return "P1_EVERY_2_3_DAYS";
  return "P2_WEEKLY";
}

export const dataSourcesSeed: DataSourceSeed[] = organizationsSeed.map((organization) => {
  const override = confirmedSourceOverrides[organization.name] ?? {};
  return {
  organizationName: organization.name,
  sourceName: override.sourceName ?? `${organization.shortName}官方招聘来源（待核验）`,
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
  ...override,
  officialConfirmed: override.officialConfirmed ?? Boolean(override.sourceDomain),
  };
});

if (dataSourcesSeed.length !== 100) {
  throw new Error(`Expected 100 source records, received ${dataSourcesSeed.length}`);
}
