export type Batch1SourceStatus = "SUCCESS" | "NO_ACTIVE_RECORD" | "TIMEOUT" | "REDIRECT_BLOCKED" | "HTTP_ERROR";

export type Batch1SourceAudit = {
  key: string;
  organizationName: string;
  sourceName: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: "招聘官网" | "企业官网";
  status: Batch1SourceStatus;
  discoveredCount: number;
  failureType: string | null;
  note: string;
};

export type Batch1Record = {
  externalId: string;
  sourceKey: string;
  organizationName: string;
  title: string;
  originalContent: string;
  opportunityType: "ENTERPRISE_CAMPUS" | "BANK_CAMPUS";
  opportunityStatus?: "recruiting" | "upcoming";
  recruitmentSeason: "EARLY" | "AUTUMN" | "SPRING" | "SUPPLEMENTARY" | "INTERNSHIP" | "DAILY" | "OTHER";
  recruitmentYear: number;
  batchName: string;
  targetGraduationYears: number[];
  degreeRequirements: string[];
  majorRequirementText: string;
  workLocations: string[];
  publishedAt: string | null;
  deadlineAt: string | null;
  deadlineType: "FIXED_DATE" | "UNTIL_FILLED" | "NOT_ANNOUNCED" | "LONG_TERM" | "ESTIMATED" | "OTHER";
  officialAnnouncementUrl: string;
  officialApplicationUrl: string;
  sourceEvidence: string;
};

const noActive = (key: string, organizationName: string, sourceName: string, sourceUrl: string, sourceDomain: string, sourceType: Batch1SourceAudit["sourceType"], note = "本次人工检查了官方入口，但未确认当前面向2027届的公开有效招聘项目；仅保留来源审计，不创建招聘机会。") => ({
  key, organizationName, sourceName, sourceUrl, sourceDomain, sourceType,
  status: "NO_ACTIVE_RECORD" as const, discoveredCount: 0, failureType: null, note,
});

/**
 * BATCH 1 is an evidence snapshot from official public pages checked on
 * 2026-08-12. The monitoring master list is deliberately not represented
 * here: only official pages that describe a real graduate/campus project can
 * create a record below.
 */
export const batch1SourceAudits: Batch1SourceAudit[] = [
  {
    key: "huawei-campus", organizationName: "华为", sourceName: "华为招聘官网", sourceUrl: "https://career.huawei.com/cn/campus-recruitment", sourceDomain: "career.huawei.com", sourceType: "招聘官网", status: "SUCCESS", discoveredCount: 1, failureType: null,
    note: "官方校园招聘页显示“华为2027届实习生招聘正式启动”，并给出2027届对象和官方投递入口。",
  },
  noActive("tencent-campus", "腾讯", "腾讯招聘校园招聘入口", "https://careers.tencent.com/en-us/campusrecruit.html?from=overseas", "careers.tencent.com", "招聘官网", "官方校园招聘页可访问并面向2026-2027毕业生，但本次未确认独立的2027届公开项目标题；不创建机会。"),
  {
    key: "alibaba-campus", organizationName: "阿里巴巴集团", sourceName: "阿里巴巴校园招聘官网", sourceUrl: "https://campus-talent.alibaba.com/campus/gov", sourceDomain: "campus-talent.alibaba.com", sourceType: "招聘官网", status: "SUCCESS", discoveredCount: 1, failureType: null,
    note: "官方校园招聘页显示面向2026年11月至2027年10月毕业生的应届招聘入口。",
  },
  {
    key: "bytedance-campus", organizationName: "字节跳动", sourceName: "字节跳动校园招聘官网", sourceUrl: "https://jobs.bytedance.com/campus/page-6272Gc", sourceDomain: "jobs.bytedance.com", sourceType: "招聘官网", status: "SUCCESS", discoveredCount: 1, failureType: null,
    note: "官方问答页确认2027届校招，投递时间为2026年8月至2027年5月31日。",
  },
  {
    key: "meituan-campus", organizationName: "美团", sourceName: "美团校园招聘官网", sourceUrl: "https://zhaopin.meituan.com/web/campus", sourceDomain: "zhaopin.meituan.com", sourceType: "招聘官网", status: "HTTP_ERROR", discoveredCount: 0, failureType: "HTTP_501",
    note: "官方招聘域名本次访问返回HTTP 501，未采集正文，未创建机会。",
  },
  noActive("jd-campus", "京东", "京东校园招聘官网", "https://campus.jd.com/", "campus.jd.com", "招聘官网"),
  {
    key: "baidu-campus", organizationName: "百度", sourceName: "百度校园招聘官网", sourceUrl: "https://talent.baidu.com/jobs/campus", sourceDomain: "talent.baidu.com", sourceType: "招聘官网", status: "SUCCESS", discoveredCount: 1, failureType: null,
    note: "官方校招页展示2027届项目；官方职位页显示校招岗位列表。",
  },
  noActive("xiaomi-campus", "小米集团", "小米校园招聘官网", "https://hr.xiaomi.com/campus/", "hr.xiaomi.com", "招聘官网"),
  {
    key: "pdd-campus", organizationName: "拼多多集团", sourceName: "拼多多集团校园招聘官网", sourceUrl: "https://careers.pddglobalhr.com/campus/", sourceDomain: "careers.pddglobalhr.com", sourceType: "招聘官网", status: "SUCCESS", discoveredCount: 1, failureType: null,
    note: "官方校招页展示2027届校园招聘，毕业时间为2026年9月至2027年8月。",
  },
  noActive("netease-campus", "网易", "网易招聘官网", "https://hr.163.com/", "hr.163.com", "招聘官网"),
  noActive("kuaishou-campus", "快手", "快手招聘官网", "https://zhaopin.kuaishou.com/", "zhaopin.kuaishou.com", "招聘官网"),
  {
    key: "byd-campus", organizationName: "比亚迪", sourceName: "比亚迪招聘官网", sourceUrl: "https://job.byd.com/portal/mobile/school-home", sourceDomain: "job.byd.com", sourceType: "招聘官网", status: "SUCCESS", discoveredCount: 1, failureType: null,
    note: "官方校园招聘页显示“27届校招即将开始”，并展示2027届毕业时间范围和官方投递入口。",
  },
  noActive("catl-campus", "宁德时代", "宁德时代招聘官网", "https://talent.catl.com/", "talent.catl.com", "招聘官网"),
  noActive("geely-campus", "吉利汽车", "吉利招聘官网", "https://zhaopin.geely.com/", "zhaopin.geely.com", "招聘官网"),
  noActive("chery-campus", "奇瑞汽车", "奇瑞企业官网", "https://www.chery.cn/", "www.chery.cn", "企业官网"),
  noActive("lixiang-campus", "理想汽车", "理想汽车企业官网", "https://www.lixiang.com/", "www.lixiang.com", "企业官网"),
  noActive("nio-campus", "蔚来", "蔚来企业官网", "https://www.nio.com/", "www.nio.com", "企业官网"),
  noActive("xpeng-campus", "小鹏汽车", "小鹏汽车招聘入口", "https://www.xiaopeng.com/join.html", "www.xiaopeng.com", "企业官网"),
  noActive("sgcc-campus", "国家电网", "国家电网招聘平台", "https://zhaopin.sgcc.com.cn/", "zhaopin.sgcc.com.cn", "招聘官网"),
  noActive("csg-campus", "南方电网", "南方电网招聘平台", "https://zhaopin.csg.cn/", "zhaopin.csg.cn", "招聘官网"),
  noActive("cmcc-campus", "中国移动", "中国移动招聘网站", "https://job.10086.cn/", "job.10086.cn", "招聘官网"),
  noActive("ctcc-campus", "中国电信", "中国电信招聘网站", "https://job.chinatelecom.com.cn/wt/TELE/web/index", "job.chinatelecom.com.cn", "招聘官网"),
  noActive("cucc-campus", "中国联通", "中国联通官网", "https://www.chinaunicom.com/", "www.chinaunicom.com", "企业官网"),
  noActive("cnpc-campus", "中国石油", "中国石油招聘平台", "https://zhaopin.cnpc.com.cn/", "zhaopin.cnpc.com.cn", "招聘官网"),
  noActive("sinopec-campus", "中国石化", "中国石化招聘平台", "https://job.sinopec.com/", "job.sinopec.com", "招聘官网"),
  noActive("chnenergy-campus", "国家能源集团", "国家能源集团招聘平台", "https://zhaopin.chnenergy.com.cn/", "zhaopin.chnenergy.com.cn", "招聘官网"),
  noActive("spic-campus", "国家电投", "国家电投企业官网", "https://www.spic.com.cn/", "www.spic.com.cn", "企业官网"),
  noActive("icbc-campus", "工商银行", "工商银行招聘平台", "https://job.icbc.com.cn/", "job.icbc.com.cn", "招聘官网"),
  noActive("abc-campus", "农业银行", "农业银行招聘入口", "https://career.abchina.com/", "career.abchina.com", "招聘官网"),
  {
    key: "boc-campus", organizationName: "中国银行", sourceName: "中国银行招聘公告", sourceUrl: "https://www.boc.cn/aboutboc/bi4/202603/t20260311_25654054.html", sourceDomain: "boc.cn", sourceType: "企业官网", status: "SUCCESS", discoveredCount: 1, failureType: null,
    note: "中国银行官网2026年实习生公告明确面向2027年应届毕业生，属于当前有效的2027届实习机会。",
  },
  noActive("ccb-campus", "建设银行", "建设银行招聘平台", "https://job.ccb.com/cn/job/index.html", "job.ccb.com", "招聘官网"),
];

export const batch1Records: Batch1Record[] = [
  {
    externalId: "batch1-huawei-2027-internship", sourceKey: "huawei-campus", organizationName: "华为", title: "华为2027届实习生招聘",
    originalContent: "华为官方校园招聘页显示：华为2027届实习生招聘正式启动，招聘对象主要面向2027届毕业的在校学生；简历注册和岗位投递通过华为招聘官网完成。",
    opportunityType: "ENTERPRISE_CAMPUS", recruitmentSeason: "INTERNSHIP", recruitmentYear: 2027, batchName: "2027届实习生招聘", targetGraduationYears: [2027], degreeRequirements: [], majorRequirementText: "具体岗位专业要求以官方职位详情为准", workLocations: ["全国"], publishedAt: "2026-03-15", deadlineAt: null, deadlineType: "NOT_ANNOUNCED",
    officialAnnouncementUrl: "https://career.huawei.com/cn/campus-recruitment", officialApplicationUrl: "https://career.huawei.com/reccampportal/", sourceEvidence: "官方页面正文与公告日期：2026年3月15日；官方FAQ说明面向2027届毕业生。",
  },
  {
    externalId: "batch1-alibaba-2027-campus", sourceKey: "alibaba-campus", organizationName: "阿里巴巴集团", title: "阿里巴巴2027届校园招聘",
    originalContent: "阿里巴巴校园招聘官方页面面向应届毕业生，页面明确毕业时间为2026年11月至2027年10月；具体职类和岗位以阿里巴巴校园招聘官网为准。",
    opportunityType: "ENTERPRISE_CAMPUS", recruitmentSeason: "AUTUMN", recruitmentYear: 2027, batchName: "应届生招聘", targetGraduationYears: [2027], degreeRequirements: [], majorRequirementText: "具体岗位专业要求以官方职位详情为准", workLocations: ["全国"], publishedAt: null, deadlineAt: null, deadlineType: "NOT_ANNOUNCED",
    officialAnnouncementUrl: "https://campus-talent.alibaba.com/campus/gov", officialApplicationUrl: "https://campus-talent.alibaba.com/campus/gov", sourceEvidence: "阿里巴巴校园招聘官方页面明确毕业时间范围和官方投递入口。",
  },
  {
    externalId: "batch1-bytedance-2027-campus", sourceKey: "bytedance-campus", organizationName: "字节跳动", title: "字节跳动2027届校园招聘",
    originalContent: "字节跳动官方校招问答页：2027届校园招聘面向2026年9月至2027年8月毕业的学生，投递时间为2026年8月至2027年5月31日；校园招聘官网为唯一投递入口。",
    opportunityType: "ENTERPRISE_CAMPUS", recruitmentSeason: "AUTUMN", recruitmentYear: 2027, batchName: "正式批", targetGraduationYears: [2027], degreeRequirements: [], majorRequirementText: "官方说明不以专业和学历作统一限制，具体以职位描述为准", workLocations: [], publishedAt: null, deadlineAt: "2027-05-31", deadlineType: "FIXED_DATE",
    officialAnnouncementUrl: "https://jobs.bytedance.com/campus/page-6272Gc", officialApplicationUrl: "https://jobs.bytedance.com/campus", sourceEvidence: "官方校招问答页明确2027届、投递期限和唯一投递入口。",
  },
  {
    externalId: "batch1-baidu-2027-campus", sourceKey: "baidu-campus", organizationName: "百度", title: "百度集团2027届校园招聘",
    originalContent: "百度官方校招页：面向2026年9月至2027年8月毕业的在校生，开放技术、产品、政企、销售、综合五大类岗位；官方职位页显示校招职位列表。",
    opportunityType: "ENTERPRISE_CAMPUS", recruitmentSeason: "AUTUMN", recruitmentYear: 2027, batchName: "正式批", targetGraduationYears: [2027], degreeRequirements: [], majorRequirementText: "具体专业要求以官方职位详情为准", workLocations: ["北京", "上海", "深圳"], publishedAt: "2026-08-05", deadlineAt: null, deadlineType: "NOT_ANNOUNCED",
    officialAnnouncementUrl: "https://talent.baidu.com/jobs/campus", officialApplicationUrl: "https://talent.baidu.com/jobs/list?projectType=1", sourceEvidence: "百度官方校招首页和职位列表页均可访问，毕业时间和职位列表来自页面正文。",
  },
  {
    externalId: "batch1-pdd-2027-campus", sourceKey: "pdd-campus", organizationName: "拼多多集团", title: "拼多多集团-PDD 2027届校园招聘",
    originalContent: "拼多多官方校招页展示2027届校园招聘，毕业时间为2026年9月至2027年8月，提供官方投递入口。",
    opportunityType: "ENTERPRISE_CAMPUS", recruitmentSeason: "AUTUMN", recruitmentYear: 2027, batchName: "正式批", targetGraduationYears: [2027], degreeRequirements: [], majorRequirementText: "以官方岗位详情为准", workLocations: ["全国"], publishedAt: null, deadlineAt: null, deadlineType: "NOT_ANNOUNCED",
    officialAnnouncementUrl: "https://careers.pddglobalhr.com/campus/", officialApplicationUrl: "https://careers.pddglobalhr.com/campus/", sourceEvidence: "官方校招页展示2027届校园招聘入口，未在首页集中公布截止时间。",
  },
  {
    externalId: "batch1-byd-2027-campus", sourceKey: "byd-campus", organizationName: "比亚迪", title: "比亚迪2027届校园招聘",
    originalContent: "比亚迪官方校园招聘页显示：26届校招已结束，27届校招即将开始；页面展示2027届毕业时间范围、网申入口和校园招聘流程。",
    opportunityType: "ENTERPRISE_CAMPUS", recruitmentSeason: "AUTUMN", recruitmentYear: 2027, batchName: "27届校招", targetGraduationYears: [2027], degreeRequirements: [], majorRequirementText: "具体专业要求以官方岗位详情为准", workLocations: ["全国"], publishedAt: null, deadlineAt: null, deadlineType: "NOT_ANNOUNCED",
    opportunityStatus: "upcoming",
    officialAnnouncementUrl: "https://job.byd.com/portal/mobile/school-home", officialApplicationUrl: "https://job.byd.com/portal/mobile/school-home", sourceEvidence: "比亚迪招聘官网页面正文明确写明27届校招即将开始，并展示官方Apply Now入口。",
  },
  {
    externalId: "batch1-boc-2027-internship", sourceKey: "boc-campus", organizationName: "中国银行", title: "中国银行2026年实习生招聘（面向2027届）",
    originalContent: "中国银行官网公告：2026年实习生招聘中，总行部门实习生（信科）等岗位面向国内外院校招收2027年应届毕业生；公告同时说明官方网站和实习生招聘网站为官方渠道。",
    opportunityType: "BANK_CAMPUS", recruitmentSeason: "INTERNSHIP", recruitmentYear: 2027, batchName: "2026年实习生招聘", targetGraduationYears: [2027], degreeRequirements: [], majorRequirementText: "信息科技相关专业等，具体以官方公告和岗位详情为准", workLocations: ["北京"], publishedAt: "2026-03-11", deadlineAt: null, deadlineType: "NOT_ANNOUNCED",
    officialAnnouncementUrl: "https://www.boc.cn/aboutboc/bi4/202603/t20260311_25654054.html", officialApplicationUrl: "https://www.boc.cn/aboutboc/bi4/202603/t20260311_25654054.html", sourceEvidence: "中国银行官网公告正文明确面向2027年应届毕业生，并明确官方发布渠道。",
  },
];
