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
  "国家能源投资集团有限责任公司": {
    sourceName: "国家能源集团人力资源招聘网站（待复核）",
    sourceDomain: "zhaopin.chnenergy.com.cn",
    sourceUrl: "https://zhaopin.chnenergy.com.cn/index1",
    listPageUrl: "https://zhaopin.chnenergy.com.cn/index1",
    sourceType: "招聘官网",
    notes: "国家能源集团官方招聘网站已打开，页面含招聘公告及用户协议/登录入口；robots、条款、验证码与允许路径仍待人工核验。",
  },
  "中国电子科技集团有限公司": {
    sourceName: "中国电科官网招聘及公告（待复核）",
    sourceDomain: "www.cetc.com.cn",
    sourceUrl: "https://www.cetc.com.cn/zgdk/1593022/1592495/index.html",
    listPageUrl: "https://www.cetc.com.cn/zgdk/1593022/1592495/index.html",
    sourceType: "企业官网",
    notes: "中国电科官网人力资源/招聘栏目已打开，并出现中国电科2026届校园招聘启动公告；robots、条款与允许路径仍待人工核验。",
  },
  "中国中车集团有限公司": {
    sourceName: "中国中车官网人才招聘（待复核）",
    sourceDomain: "www.crrcgc.cc",
    sourceUrl: "https://www.crrcgc.cc/eportal/ui?pageId=714859",
    listPageUrl: "https://crrc.hotjob.cn/",
    sourceType: "企业官网",
    notes: "中国中车官网人力资源/人才招聘栏目已打开，并链接至官方候选人招聘入口crrc.hotjob.cn；需人工核验robots、条款与允许路径。",
  },
  "中国建筑集团有限公司": {
    sourceName: "中国建筑招聘平台（待复核）",
    sourceDomain: "recruit.cscec.com",
    sourceUrl: "https://recruit.cscec.com/",
    sourceType: "招聘官网",
    requiresJavascript: true,
    notes: "中国建筑招聘平台入口已定位；直连正文为空，需人工浏览器复核页面及访问边界，暂不自动采集。",
  },
  "华润集团有限公司": {
    sourceName: "华润集团人才招聘（待复核）",
    sourceDomain: "crc.wintalent.cn",
    sourceUrl: "https://crc.wintalent.cn/wt/CRC/web/index/CompCRCPageindex",
    sourceType: "招聘官网",
    notes: "华润集团招聘网站已打开；robots、服务条款、登录/验证码边界与允许路径仍待人工核验。",
  },
  "字节跳动": {
    sourceName: "字节跳动校园招聘（待复核）",
    sourceDomain: "jobs.bytedance.com",
    sourceUrl: "https://jobs.bytedance.com/campus/",
    listPageUrl: "https://jobs.bytedance.com/campus/",
    sourceType: "招聘官网",
    notes: "字节跳动校园招聘官网已打开并展示招聘项目；需人工核验robots、条款与允许路径后再评估采集方式。",
  },
  "腾讯": {
    sourceName: "腾讯招聘及校园招聘入口（待复核）",
    sourceDomain: "careers.tencent.com",
    sourceUrl: "https://careers.tencent.com/zh-cn/",
    listPageUrl: "https://careers.tencent.com/zh-cn/jobopportunity.html",
    sourceType: "招聘官网",
    notes: "腾讯官方招聘站已定位，官方页面提供校园招聘入口说明；当前页面正文抓取为空，需人工浏览器复核。",
  },
  "阿里巴巴集团": {
    sourceName: "阿里巴巴校园招聘（待复核）",
    sourceDomain: "campus-talent.alibaba.com",
    sourceUrl: "https://campus-talent.alibaba.com/",
    listPageUrl: "https://campus-talent.alibaba.com/",
    sourceType: "招聘官网",
    notes: "阿里巴巴校园招聘官网已打开并跳转至校园招聘页面；需人工核验robots、条款及允许路径。",
  },
  "美团": {
    sourceName: "美团校园招聘（待复核）",
    sourceDomain: "zhaopin.meituan.com",
    sourceUrl: "https://zhaopin.meituan.com/web/campus",
    listPageUrl: "https://zhaopin.meituan.com/web/campus",
    sourceType: "招聘官网",
    notes: "美团校园招聘官网入口已定位；直连正文为空，需人工浏览器复核页面及访问边界，暂不自动采集。",
  },
  "百度": {
    sourceName: "百度校园招聘（待复核）",
    sourceDomain: "talent.baidu.com",
    sourceUrl: "https://talent.baidu.com/jobs/campus",
    listPageUrl: "https://talent.baidu.com/jobs/campus",
    sourceType: "招聘官网",
    notes: "百度校园招聘官网已打开并展示校招项目与岗位入口；需人工核验robots、条款与允许路径。",
  },
  "京东集团": {
    sourceName: "京东招聘及校园招聘入口（待复核）",
    sourceDomain: "zhaopin.jd.com",
    sourceUrl: "https://zhaopin.jd.com/",
    listPageUrl: "https://campus.jd.com/",
    sourceType: "招聘官网",
    notes: "京东招聘官网已打开并提供校园招聘入口；需人工核验robots、条款与允许路径。",
  },
  "小米集团": {
    sourceName: "小米校园招聘（待复核）",
    sourceDomain: "hr.xiaomi.com",
    sourceUrl: "https://hr.xiaomi.com/campus/",
    listPageUrl: "https://hr.xiaomi.com/campus/",
    sourceType: "招聘官网",
    notes: "小米校园招聘官网已打开并展示招聘项目、投递须知与宣讲会；需人工核验robots、条款与允许路径。",
  },
  "华为": {
    sourceName: "华为校园招聘（待复核）",
    sourceDomain: "career.huawei.com",
    sourceUrl: "https://career.huawei.com/cn/campus-recruitment",
    listPageUrl: "https://career.huawei.com/cn/campus-recruitment",
    sourceType: "招聘官网",
    notes: "华为官方校园招聘页面已定位，包含应届生招聘与校招活动；需人工核验robots、条款与允许路径。",
  },
  "中国工商银行": {
    sourceName: "中国工商银行人才招聘（待复核）",
    sourceDomain: "job.icbc.com.cn",
    sourceUrl: "https://job.icbc.com.cn/pc/index.html",
    listPageUrl: "https://job.icbc.com.cn/pc/index.html",
    sourceType: "招聘官网",
    notes: "中国工商银行人才招聘入口已定位；直连正文为空，需人工浏览器复核页面及访问边界。",
  },
  "中国建设银行": {
    sourceName: "中国建设银行人才招聘（待复核）",
    sourceDomain: "job.ccb.com",
    sourceUrl: "https://job.ccb.com/cn/job/index.html",
    listPageUrl: "https://job.ccb.com/cn/job/index.html",
    sourceType: "招聘官网",
    notes: "中国建设银行招聘官网已打开并展示校园招聘入口；需人工核验robots、条款与允许路径。",
  },
  "比亚迪": {
    sourceName: "比亚迪校园招聘（待复核）",
    sourceDomain: "job.byd.com",
    sourceUrl: "https://job.byd.com/portal/mobile/school-home",
    listPageUrl: "https://job.byd.com/portal/mobile/school-home",
    sourceType: "招聘官网",
    notes: "比亚迪校园招聘入口已定位；直连正文为空，需人工浏览器复核页面及访问边界。",
  },
  "宁德时代": {
    sourceName: "宁德时代全球校园招聘（待复核）",
    sourceDomain: "talent.catl.com",
    sourceUrl: "https://talent.catl.com/",
    listPageUrl: "https://talent.catl.com/",
    sourceType: "招聘官网",
    notes: "宁德时代官方招聘入口已定位；当前直连存在重定向循环，需人工浏览器复核页面及访问边界。",
  },
  "中国石油天然气集团有限公司": {
    sourceName: "中国石油高校毕业生招聘平台（待复核）",
    sourceDomain: "zhaopin.cnpc.com.cn",
    sourceUrl: "https://zhaopin.cnpc.com.cn/",
    listPageUrl: "https://zhaopin.cnpc.com.cn/",
    sourceType: "招聘官网",
    notes: "中国石油官方招聘公告明确该平台为高校毕业生招聘唯一渠道；直连超时，需人工复核可访问性与访问边界。",
  },
  "国家电力投资集团有限公司": {
    sourceName: "国家电投校园招聘（待复核）",
    sourceDomain: "spic2026.iguopin.com",
    sourceUrl: "https://spic2026.iguopin.com/",
    listPageUrl: "https://spic2026.iguopin.com/",
    sourceType: "招聘官网",
    requiresJavascript: true,
    notes: "国家电投官网‘招贤纳士-校园招聘’链接至该入口；页面提示需要JavaScript，robots/条款与允许路径仍待人工核验。",
  },
  "中国航天科技集团有限公司": {
    sourceName: "中国航天科技集团官网人才招聘（待复核）",
    sourceDomain: "www.spacechina.com",
    sourceUrl: "https://www.spacechina.com/",
    sourceType: "企业官网",
    notes: "中国航天科技集团官网已定位，官网包含人才招聘相关入口/内容；直连正文为空，需人工浏览器复核。",
  },
  "中国航空工业集团有限公司": {
    sourceName: "中国航空工业集团官网（待复核）",
    sourceDomain: "www.avic.com.cn",
    sourceUrl: "https://www.avic.com.cn/",
    sourceType: "企业官网",
    notes: "中国航空工业集团官网已打开并显示官方集团信息；2026校招公告可由官方公告渠道追溯，需人工核验具体招聘入口和访问边界。",
  },
  "中国第一汽车集团有限公司": {
    sourceName: "中国一汽校园招聘（待复核）",
    sourceDomain: "faw-zhaopin.hotjob.cn",
    sourceUrl: "https://faw-zhaopin.hotjob.cn/campusRecruitment",
    listPageUrl: "https://faw-zhaopin.hotjob.cn/campusRecruitment",
    sourceType: "招聘官网",
    requiresJavascript: true,
    notes: "中国一汽校园招聘入口已打开并显示JavaScript应用；需人工核验robots、条款、验证码与允许路径。",
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
