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
  recruitmentSeason: "AUTUMN" | "SPRING";
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

/**
 * BATCH 1 is an evidence snapshot from official public pages checked on
 * 2026-08-11. It is intentionally small and auditable: no search-result or
 * third-party listing is promoted by this dataset.
 */
export const batch1SourceAudits: Batch1SourceAudit[] = [
  {
    key: "pdd-campus",
    organizationName: "拼多多集团",
    sourceName: "拼多多集团校园招聘官网",
    sourceUrl: "https://careers.pddglobalhr.com/campus/",
    sourceDomain: "careers.pddglobalhr.com",
    sourceType: "招聘官网",
    status: "SUCCESS",
    discoveredCount: 1,
    failureType: null,
    note: "官方校招页展示2027届校园招聘，毕业时间为2026年9月至2027年8月。",
  },
  {
    key: "baidu-campus",
    organizationName: "百度",
    sourceName: "百度校园招聘官网",
    sourceUrl: "https://talent.baidu.com/jobs/campus",
    sourceDomain: "talent.baidu.com",
    sourceType: "招聘官网",
    status: "SUCCESS",
    discoveredCount: 1,
    failureType: null,
    note: "官方校招页展示2027届项目，开放技术、产品、政企、销售、综合方向；职位页显示147条校招职位。",
  },
  {
    key: "bytedance-campus",
    organizationName: "字节跳动",
    sourceName: "字节跳动校园招聘官网",
    sourceUrl: "https://jobs.bytedance.com/campus/page-6272Gc",
    sourceDomain: "jobs.bytedance.com",
    sourceType: "招聘官网",
    status: "SUCCESS",
    discoveredCount: 1,
    failureType: null,
    note: "官方问答页确认2027届校招，投递时间为2026年8月至2027年5月31日，官网为唯一投递入口。",
  },
  {
    key: "mihoyo-campus",
    organizationName: "米哈游",
    sourceName: "米哈游校园招聘官网",
    sourceUrl: "https://campus.mihoyo.com/",
    sourceDomain: "campus.mihoyo.com",
    sourceType: "招聘官网",
    status: "NO_ACTIVE_RECORD",
    discoveredCount: 0,
    failureType: null,
    note: "官方页面可访问并明确面向2027届，但当前页面显示0个应届生职位，本批不创建机会记录。",
  },
  {
    key: "xiaomi-campus",
    organizationName: "小米集团",
    sourceName: "小米校园招聘官网",
    sourceUrl: "https://hr.xiaomi.com/website/campus.html",
    sourceDomain: "hr.xiaomi.com",
    sourceType: "招聘官网",
    status: "NO_ACTIVE_RECORD",
    discoveredCount: 0,
    failureType: null,
    note: "官方校园招聘页可访问，但本次正文未确认当前2027届校招项目，保留数据源审计，不创建正式机会。",
  },
  {
    key: "meituan-campus",
    organizationName: "美团",
    sourceName: "美团校园招聘官网",
    sourceUrl: "https://zhaopin.meituan.com/web/campus",
    sourceDomain: "zhaopin.meituan.com",
    sourceType: "招聘官网",
    status: "HTTP_ERROR",
    discoveredCount: 0,
    failureType: "HTTP_501",
    note: "官方招聘域名可定位，但本次访问返回HTTP 501，未采集正文，未创建机会。",
  },
  {
    key: "tencent-campus",
    organizationName: "腾讯",
    sourceName: "腾讯招聘校园招聘入口",
    sourceUrl: "https://careers.tencent.com/zh-cn/jobopportunity.html",
    sourceDomain: "careers.tencent.com",
    sourceType: "招聘官网",
    status: "TIMEOUT",
    discoveredCount: 0,
    failureType: "TIMEOUT",
    note: "官方招聘入口本次访问超时，未使用搜索结果或第三方内容补录。",
  },
  {
    key: "alibaba-campus",
    organizationName: "阿里巴巴集团",
    sourceName: "阿里巴巴校园招聘官网",
    sourceUrl: "https://campus-talent.alibaba.com/",
    sourceDomain: "campus-talent.alibaba.com",
    sourceType: "招聘官网",
    status: "REDIRECT_BLOCKED",
    discoveredCount: 0,
    failureType: "REDIRECT_TO_HTTP",
    note: "官方入口重定向到HTTP地址，按安全规则未跟随非HTTPS跳转，未创建机会。",
  },
];

export const batch1Records: Batch1Record[] = [
  {
    externalId: "batch1-pdd-2027-campus",
    sourceKey: "pdd-campus",
    organizationName: "拼多多集团",
    title: "拼多多集团-PDD 2027届校园招聘",
    originalContent: "官方校招页：应届生招聘，2027届校园招聘，毕业时间为2026年9月至2027年8月，提供官方投递入口。",
    recruitmentSeason: "AUTUMN",
    recruitmentYear: 2027,
    batchName: "正式批",
    targetGraduationYears: [2027],
    degreeRequirements: [],
    majorRequirementText: "以官方岗位详情为准",
    workLocations: ["全国"],
    publishedAt: null,
    deadlineAt: null,
    deadlineType: "NOT_ANNOUNCED",
    officialAnnouncementUrl: "https://careers.pddglobalhr.com/campus/",
    officialApplicationUrl: "https://careers.pddglobalhr.com/campus/",
    sourceEvidence: "官方校招页展示2027届校园招聘入口；未在首页集中公布截止时间。",
  },
  {
    externalId: "batch1-baidu-2027-campus",
    sourceKey: "baidu-campus",
    organizationName: "百度",
    title: "百度集团2027届校园招聘",
    originalContent: "官方校招页：面向2026年9月至2027年8月毕业的在校生，开放技术、产品、政企、销售、综合五大类岗位，覆盖北京、上海、深圳等城市；官方职位页显示147条校招职位。",
    recruitmentSeason: "AUTUMN",
    recruitmentYear: 2027,
    batchName: "正式批",
    targetGraduationYears: [2027],
    degreeRequirements: [],
    majorRequirementText: "具体专业要求以官方职位详情为准",
    workLocations: ["北京", "上海", "深圳"],
    publishedAt: "2026-08-05",
    deadlineAt: null,
    deadlineType: "NOT_ANNOUNCED",
    officialAnnouncementUrl: "https://talent.baidu.com/jobs/campus",
    officialApplicationUrl: "https://talent.baidu.com/jobs/list?projectType=1",
    sourceEvidence: "官方校招首页与官方职位列表页均可访问；职位数量和毕业时间来自页面正文。",
  },
  {
    externalId: "batch1-bytedance-2027-campus",
    sourceKey: "bytedance-campus",
    organizationName: "字节跳动",
    title: "字节跳动2027届校园招聘",
    originalContent: "官方校招问答页：2027届校园招聘面向2026年9月至2027年8月毕业的学生，投递时间为2026年8月至2027年5月31日；校园招聘官网为唯一投递入口。",
    recruitmentSeason: "AUTUMN",
    recruitmentYear: 2027,
    batchName: "正式批",
    targetGraduationYears: [2027],
    degreeRequirements: [],
    majorRequirementText: "官方说明不以专业和学历作统一限制，具体以职位描述为准",
    workLocations: [],
    publishedAt: null,
    deadlineAt: "2027-05-31",
    deadlineType: "FIXED_DATE",
    officialAnnouncementUrl: "https://jobs.bytedance.com/campus/page-6272Gc",
    officialApplicationUrl: "https://jobs.bytedance.com/campus",
    sourceEvidence: "官方校招问答页明确2027届、投递期限和唯一投递入口。",
  },
];
