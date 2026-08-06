import { realProjects } from "./real-projects";

export type BrandConfig = {
  name: string;
  logoText: string;
  edition: string;
  homeTitle: string;
  homeSubtitle: string;
  marketingCopy: string;
  disclaimer: string;
  cutoffDays: number;
  demoMode: boolean;
};

export const siteConfig: BrandConfig = {
  name: "校招雷达",
  logoText: "⌁",
  edition: "2027届",
  homeTitle: "不错过每一次重要机会",
  homeSubtitle: "统一整理大厂校招、央国企招聘、国考、省考、事业单位和军队文职信息，帮你及时发现并管理关键报名时间。",
  marketingCopy: "面向应届毕业生的一站式招聘、考公、考编与军队文职机会日历和提醒工具。",
  disclaimer: "本平台仅整理公开招聘信息，招聘时间、专业要求及报名资格可能发生变化，请在报名前再次核对招聘单位官方网站。",
  cutoffDays: 7,
  demoMode: false,
};

export type ProjectStatus = "recruiting" | "upcoming" | "ending" | "closed";
export type MatchLevel = "明确匹配" | "专业大类匹配" | "不限专业" | "可能匹配" | "暂无匹配依据";
export type OpportunityType = "ENTERPRISE_CAMPUS" | "CENTRAL_SOE" | "LOCAL_SOE" | "NATIONAL_CIVIL_SERVICE" | "PROVINCIAL_CIVIL_SERVICE" | "SELECTED_GRADUATE" | "PUBLIC_INSTITUTION" | "MILITARY_CIVILIAN" | "OTHER";
export type DeadlineType = "FIXED_DATE" | "UNTIL_FILLED" | "NOT_ANNOUNCED" | "LONG_TERM" | "ESTIMATED" | "OTHER";
export type ApplicationStatus =
  | "暂未处理"
  | "准备报名"
  | "已报名"
  | "已完成测评"
  | "已参加笔试"
  | "已进入面试"
  | "已结束";

export type Project = {
  id: string;
  company: string;
  shortName: string;
  logoTone: string;
  companyType: string;
  companyNature: string;
  batch: string;
  title: string;
  intro: string;
  graduationYears: string[];
  degrees: string[];
  originalMajors: string;
  majors: string[];
  majorCategory: string[];
  relatedMajor: boolean;
  noMajorLimit: boolean;
  regions: string[];
  publishedAt: string;
  startAt: string;
  deadline: string;
  opportunityType?: OpportunityType;
  deadlineType?: DeadlineType;
  status: ProjectStatus;
  sourceName: string;
  sourceLevel: "A级" | "B级" | "C级" | "D级";
  sourceType?: string;
  announcementUrl?: string;
  applicationUrl?: string;
  officialPageStatus?: "可访问" | "待复核" | "无法访问";
  verifiedAt: string;
  recommended?: boolean;
  pinned?: boolean;
  link: string;
  applications?: ApplicationStatus;
  note?: string;
  recordStatus?: "真实数据" | "演示数据";
};

export const demoProjects: Project[] = [
  {
    id: "p1",
    company: "华辰能源集团",
    shortName: "华辰能源",
    logoTone: "teal",
    companyType: "央企",
    companyNature: "能源电力",
    batch: "秋招",
    title: "华辰能源集团2027届秋季校园招聘",
    intro: "面向能源、电气、计算机、财务等方向的应届毕业生，覆盖总部及下属单位技术与管理岗位。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士", "博士"],
    originalMajors: "电气工程、能源动力、计算机、财务管理、经济学等相关专业",
    majors: ["电气工程及其自动化", "计算机科学与技术", "软件工程", "财务管理", "经济学"],
    majorCategory: ["工学", "管理学", "经济学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["北京", "武汉", "全国"],
    publishedAt: "2026-08-03",
    startAt: "2026-08-04",
    deadline: "2026-08-18",
    status: "recruiting",
    sourceName: "华辰能源招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-05",
    recommended: true,
    pinned: true,
    link: "https://example.com/huachen-recruitment",
    applications: "准备报名",
    note: "周日前完成网申，准备英文自我介绍",
  },
  {
    id: "p2",
    company: "国能城市建设研究院",
    shortName: "国能城建院",
    logoTone: "blue",
    companyType: "央企",
    companyNature: "科研设计",
    batch: "提前批",
    title: "国能城市建设研究院2027届提前批",
    intro: "聚焦城市更新、智慧建造与数字孪生方向，欢迎工科、管理与建筑设计类同学关注。",
    graduationYears: ["2027"],
    degrees: ["硕士", "博士"],
    originalMajors: "土木工程、建筑学、城乡规划、计算机及相关专业",
    majors: ["土木工程", "计算机科学与技术", "软件工程"],
    majorCategory: ["工学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["北京", "上海", "成都"],
    publishedAt: "2026-08-01",
    startAt: "2026-08-08",
    deadline: "2026-08-15",
    status: "ending",
    sourceName: "国能城建院招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-04",
    recommended: true,
    link: "https://example.com/guoneng-urban",
  },
  {
    id: "p3",
    company: "星河云计算",
    shortName: "星河云",
    logoTone: "violet",
    companyType: "互联网公司",
    companyNature: "云计算",
    batch: "秋招",
    title: "星河云计算2027届校园招聘",
    intro: "技术、产品、设计、运营多方向招聘，面向对云原生与 AI 应用感兴趣的同学。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士", "博士"],
    originalMajors: "不限专业，计算机、数学、统计、设计类专业优先",
    majors: ["计算机科学与技术", "软件工程", "人工智能", "数据科学与大数据技术"],
    majorCategory: ["工学", "理学"],
    relatedMajor: true,
    noMajorLimit: true,
    regions: ["北京", "上海", "深圳", "杭州"],
    publishedAt: "2026-08-05",
    startAt: "2026-08-10",
    deadline: "2026-09-05",
    status: "upcoming",
    sourceName: "星河云官方招聘账号",
    sourceLevel: "B级",
    verifiedAt: "2026-08-05",
    recommended: true,
    pinned: true,
    link: "https://example.com/xinghe-cloud",
    applications: "准备报名",
  },
  {
    id: "p4",
    company: "澄明科技",
    shortName: "澄明科技",
    logoTone: "orange",
    companyType: "科技企业",
    companyNature: "智能硬件",
    batch: "实习转正",
    title: "澄明科技2027届暑期实习转正招聘",
    intro: "智能终端、机器人和企业服务产品团队开放校招通道，部分岗位支持实习转正。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "计算机、电子信息、自动化、机械、工业设计等相关专业",
    majors: ["计算机科学与技术", "电子信息工程", "自动化", "机械工程"],
    majorCategory: ["工学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["深圳", "东莞"],
    publishedAt: "2026-07-20",
    startAt: "2026-07-22",
    deadline: "2026-08-09",
    status: "ending",
    sourceName: "澄明科技招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-06",
    recommended: true,
    link: "https://example.com/chengming-tech",
  },
  {
    id: "p5",
    company: "远航重工集团",
    shortName: "远航重工",
    logoTone: "slate",
    companyType: "央企",
    companyNature: "装备制造",
    batch: "秋招",
    title: "远航重工集团2027届研发类校园招聘",
    intro: "船舶装备、工业软件、先进制造方向研发岗位，提供完整的校招生培养计划。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士", "博士"],
    originalMajors: "机械工程、自动化、电气工程、材料、计算机等工科专业",
    majors: ["机械工程", "自动化", "电气工程及其自动化", "计算机科学与技术"],
    majorCategory: ["工学"],
    relatedMajor: false,
    noMajorLimit: false,
    regions: ["上海", "大连", "青岛", "全国"],
    publishedAt: "2026-08-05",
    startAt: "2026-08-20",
    deadline: "2026-09-20",
    status: "upcoming",
    sourceName: "远航重工招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-05",
    recommended: true,
    link: "https://example.com/yuanhang-heavy",
  },
  {
    id: "p6",
    company: "岚山电力设备",
    shortName: "岚山电力",
    logoTone: "green",
    companyType: "制造业企业",
    companyNature: "电力设备",
    batch: "秋招",
    title: "岚山电力设备2027届校园招聘",
    intro: "电网数字化与新能源装备双赛道，欢迎电气、自动化与软件方向同学申请。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "电气工程、自动化、通信工程、软件工程",
    majors: ["电气工程及其自动化", "自动化", "通信工程", "软件工程"],
    majorCategory: ["工学"],
    relatedMajor: false,
    noMajorLimit: false,
    regions: ["南京", "合肥", "武汉"],
    publishedAt: "2026-08-04",
    startAt: "2026-08-12",
    deadline: "2026-08-28",
    status: "upcoming",
    sourceName: "岚山电力招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-04",
    recommended: true,
    link: "https://example.com/lanshan-power",
  },
  {
    id: "p7",
    company: "沧澜商业银行",
    shortName: "沧澜银行",
    logoTone: "red",
    companyType: "金融企业",
    companyNature: "银行",
    batch: "秋招",
    title: "沧澜商业银行2027届管理培训生招聘",
    intro: "总行管培、金融科技、运营管理与营销服务方向，欢迎复合背景的应届生。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "不限专业，经济金融、计算机、数学统计、法律类优先",
    majors: ["金融学", "经济学", "计算机科学与技术", "法学"],
    majorCategory: ["经济学", "工学", "法学"],
    relatedMajor: true,
    noMajorLimit: true,
    regions: ["上海", "杭州", "全国"],
    publishedAt: "2026-08-02",
    startAt: "2026-08-10",
    deadline: "2026-08-31",
    status: "upcoming",
    sourceName: "沧澜银行招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-05",
    recommended: true,
    link: "https://example.com/canglan-bank",
    applications: "准备报名",
    note: "关注笔试时间，整理金融科技项目经历",
  },
  {
    id: "p8",
    company: "望潮证券",
    shortName: "望潮证券",
    logoTone: "indigo",
    companyType: "金融企业",
    companyNature: "证券",
    batch: "秋招",
    title: "望潮证券2027届秋季校园招聘",
    intro: "投行、研究、资管、金融科技等方向开放申请，部分职位支持跨专业投递。",
    graduationYears: ["2027"],
    degrees: ["硕士", "博士"],
    originalMajors: "金融、经济、财会、法律、计算机、数学统计等相关专业",
    majors: ["金融学", "经济学", "会计学", "法学", "数据科学与大数据技术"],
    majorCategory: ["经济学", "法学", "工学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["北京", "上海", "深圳"],
    publishedAt: "2026-07-30",
    startAt: "2026-08-01",
    deadline: "2026-08-13",
    status: "ending",
    sourceName: "望潮证券官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-06",
    link: "https://example.com/wangchao-securities",
  },
  {
    id: "p9",
    company: "北辰轨道交通",
    shortName: "北辰轨交",
    logoTone: "cyan",
    companyType: "地方国企",
    companyNature: "交通基建",
    batch: "秋招",
    title: "北辰轨道交通2027届校园招聘",
    intro: "轨道交通建设运营与智慧交通岗位，面向工程、计算机和管理类专业开放。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "土木工程、交通运输、自动化、计算机、财务管理",
    majors: ["土木工程", "自动化", "计算机科学与技术", "财务管理"],
    majorCategory: ["工学", "管理学"],
    relatedMajor: false,
    noMajorLimit: false,
    regions: ["成都", "重庆", "西安"],
    publishedAt: "2026-08-03",
    startAt: "2026-09-01",
    deadline: "2026-09-25",
    status: "upcoming",
    sourceName: "北辰轨交官方招聘账号",
    sourceLevel: "B级",
    verifiedAt: "2026-08-03",
    link: "https://example.com/beichen-metro",
  },
  {
    id: "p10",
    company: "云启生活服务",
    shortName: "云启生活",
    logoTone: "pink",
    companyType: "互联网公司",
    companyNature: "生活服务",
    batch: "秋招",
    title: "云启生活服务2027届产品与技术校招",
    intro: "面向产品、研发、数据和用户增长方向的应届生，关注真实业务中的技术应用。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "计算机、软件工程、数学统计、工业工程、市场营销",
    majors: ["计算机科学与技术", "软件工程", "数据科学与大数据技术", "市场营销"],
    majorCategory: ["工学", "理学", "管理学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["北京", "上海", "杭州"],
    publishedAt: "2026-07-30",
    startAt: "2026-08-05",
    deadline: "2026-08-26",
    status: "recruiting",
    sourceName: "云启生活招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-05",
    link: "https://example.com/yunqi-life",
    applications: "已报名",
  },
  {
    id: "p11",
    company: "经纬财产保险",
    shortName: "经纬保险",
    logoTone: "gold",
    companyType: "金融企业",
    companyNature: "保险",
    batch: "秋招",
    title: "经纬财产保险2027届校园招聘",
    intro: "精算、核保、理赔、数据分析与运营方向招聘，支持多城市发展选择。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "金融、精算、统计、计算机、工商管理、法律",
    majors: ["金融学", "经济学", "数据科学与大数据技术", "计算机科学与技术", "法学"],
    majorCategory: ["经济学", "工学", "管理学", "法学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["北京", "上海", "广州", "成都"],
    publishedAt: "2026-08-01",
    startAt: "2026-08-18",
    deadline: "2026-09-12",
    status: "upcoming",
    sourceName: "经纬保险招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-03",
    link: "https://example.com/jingwei-insurance",
  },
  {
    id: "p12",
    company: "瀚海通信",
    shortName: "瀚海通信",
    logoTone: "sky",
    companyType: "科技企业",
    companyNature: "通信技术",
    batch: "秋招",
    title: "瀚海通信2027届全球校园招聘",
    intro: "通信协议、芯片验证、软件研发与销售支持等方向，面向全球高校开放。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士", "博士"],
    originalMajors: "不限专业，电子信息、通信工程、计算机优先",
    majors: ["电子信息工程", "通信工程", "计算机科学与技术", "软件工程"],
    majorCategory: ["工学"],
    relatedMajor: true,
    noMajorLimit: true,
    regions: ["深圳", "上海", "成都", "全国"],
    publishedAt: "2026-08-04",
    startAt: "2026-08-16",
    deadline: "2026-08-30",
    status: "upcoming",
    sourceName: "瀚海通信招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-04",
    link: "https://example.com/hanhai-comms",
  },
  {
    id: "p13",
    company: "东岳生物科技",
    shortName: "东岳生物",
    logoTone: "lime",
    companyType: "科技企业",
    companyNature: "生物医药",
    batch: "秋招",
    title: "东岳生物科技2027届研发招聘",
    intro: "合成生物与生物信息学团队招聘研发人才，博士与硕士岗位均有布局。",
    graduationYears: ["2027"],
    degrees: ["硕士", "博士"],
    originalMajors: "生物、化学、药学、生物信息学、数据科学等相关专业",
    majors: ["数据科学与大数据技术"],
    majorCategory: ["理学", "工学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["上海", "苏州"],
    publishedAt: "2026-08-06",
    startAt: "2026-08-25",
    deadline: "2026-09-18",
    status: "upcoming",
    sourceName: "东岳生物招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-06",
    link: "https://example.com/dongyue-bio",
  },
  {
    id: "p14",
    company: "江南制造研究院",
    shortName: "江南研究院",
    logoTone: "forest",
    companyType: "地方国企",
    companyNature: "先进制造",
    batch: "提前批",
    title: "江南制造研究院2027届提前批招聘",
    intro: "工业机器人、精密制造与材料实验室招聘，鼓励跨学科背景同学申请。",
    graduationYears: ["2027"],
    degrees: ["硕士", "博士"],
    originalMajors: "机械、电气、材料、自动化、计算机、数学等相关专业",
    majors: ["机械工程", "电气工程及其自动化", "自动化", "计算机科学与技术"],
    majorCategory: ["工学", "理学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["苏州", "无锡", "南京"],
    publishedAt: "2026-07-28",
    startAt: "2026-08-03",
    deadline: "2026-08-12",
    status: "ending",
    sourceName: "江南研究院官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-05",
    link: "https://example.com/jiangnan-lab",
  },
  {
    id: "p15",
    company: "明启汽车集团",
    shortName: "明启汽车",
    logoTone: "charcoal",
    companyType: "制造业企业",
    companyNature: "新能源汽车",
    batch: "暑期实习",
    title: "明启汽车集团2027届暑期实习招聘",
    intro: "智能驾驶、三电系统、制造工艺与供应链方向实习招聘，项目表现优秀可转正。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "机械、车辆、电气、自动化、计算机、工业工程",
    majors: ["机械工程", "电气工程及其自动化", "自动化", "计算机科学与技术"],
    majorCategory: ["工学"],
    relatedMajor: false,
    noMajorLimit: false,
    regions: ["上海", "武汉", "合肥"],
    publishedAt: "2026-07-01",
    startAt: "2026-07-08",
    deadline: "2026-08-02",
    status: "closed",
    sourceName: "明启汽车招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-02",
    link: "https://example.com/mingqi-auto",
  },
  {
    id: "p16",
    company: "嘉禾传媒集团",
    shortName: "嘉禾传媒",
    logoTone: "rose",
    companyType: "知名企业",
    companyNature: "文化传媒",
    batch: "秋招",
    title: "嘉禾传媒集团2027届校园招聘",
    intro: "内容策划、品牌传播、视频创意与数据运营方向招聘，欢迎有作品集的同学。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "不限专业，新闻传播、汉语言文学、市场营销、设计优先",
    majors: ["新闻传播学", "汉语言文学", "市场营销"],
    majorCategory: ["文学", "管理学"],
    relatedMajor: true,
    noMajorLimit: true,
    regions: ["北京", "上海", "广州"],
    publishedAt: "2026-08-04",
    startAt: "2026-08-15",
    deadline: "2026-09-10",
    status: "upcoming",
    sourceName: "嘉禾传媒招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-05",
    link: "https://example.com/jiahe-media",
  },
  {
    id: "p17",
    company: "安澜环保集团",
    shortName: "安澜环保",
    logoTone: "emerald",
    companyType: "地方国企",
    companyNature: "环保工程",
    batch: "秋招",
    title: "安澜环保集团2027届校园招聘",
    intro: "水务、固废处理、环境工程与项目管理方向招聘，岗位覆盖多个省会城市。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "环境工程、给排水、化学、机械、电气、财务管理",
    majors: ["机械工程", "电气工程及其自动化", "财务管理"],
    majorCategory: ["工学", "管理学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["杭州", "南京", "郑州", "全国"],
    publishedAt: "2026-08-02",
    startAt: "2026-08-09",
    deadline: "2026-08-22",
    status: "recruiting",
    sourceName: "安澜环保招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-04",
    link: "https://example.com/anlan-environment",
  },
  {
    id: "p18",
    company: "拾光教育科技",
    shortName: "拾光教育",
    logoTone: "purple",
    companyType: "互联网公司",
    companyNature: "教育科技",
    batch: "秋招",
    title: "拾光教育科技2027届产品运营招聘",
    intro: "教育产品、内容运营、用户增长与技术支持方向，重视沟通与问题解决能力。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "不限专业，对教育行业和互联网产品有兴趣即可",
    majors: [],
    majorCategory: [],
    relatedMajor: false,
    noMajorLimit: true,
    regions: ["北京", "成都", "武汉"],
    publishedAt: "2026-08-06",
    startAt: "2026-08-18",
    deadline: "2026-09-08",
    status: "upcoming",
    sourceName: "拾光教育招聘官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-06",
    link: "https://example.com/shiguang-edu",
  },
  {
    id: "p19",
    company: "新陆物流科技",
    shortName: "新陆物流",
    logoTone: "amber",
    companyType: "知名企业",
    companyNature: "物流科技",
    batch: "补录",
    title: "新陆物流科技2027届校招补录",
    intro: "供应链产品、算法、运营与仓网规划岗位补录，欢迎错过秋招批次的同学关注。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "计算机、物流管理、工业工程、数学统计、工商管理",
    majors: ["计算机科学与技术", "数据科学与大数据技术", "工商管理"],
    majorCategory: ["工学", "管理学", "理学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["深圳", "广州", "杭州"],
    publishedAt: "2026-07-29",
    startAt: "2026-08-06",
    deadline: "2026-08-16",
    status: "recruiting",
    sourceName: "新陆物流官方招聘账号",
    sourceLevel: "B级",
    verifiedAt: "2026-08-05",
    link: "https://example.com/xinlu-logistics",
  },
  {
    id: "p20",
    company: "青岚建筑设计院",
    shortName: "青岚设计院",
    logoTone: "stone",
    companyType: "地方国企",
    companyNature: "建筑设计",
    batch: "秋招",
    title: "青岚建筑设计院2027届校园招聘",
    intro: "建筑、规划、结构、景观与数字设计方向招聘，重视设计作品与项目经历。",
    graduationYears: ["2027"],
    degrees: ["本科", "硕士"],
    originalMajors: "建筑学、城乡规划、土木工程、环境设计、计算机",
    majors: ["土木工程", "计算机科学与技术"],
    majorCategory: ["工学"],
    relatedMajor: true,
    noMajorLimit: false,
    regions: ["杭州", "宁波", "厦门"],
    publishedAt: "2026-08-05",
    startAt: "2026-08-24",
    deadline: "2026-09-15",
    status: "upcoming",
    sourceName: "青岚设计院官网",
    sourceLevel: "A级",
    verifiedAt: "2026-08-05",
    link: "https://example.com/qinglan-design",
  },
];

const additionalDemoProjects: Project[] = [
  { id: "p21", company: "云岭通信集团", shortName: "云岭通信", logoTone: "blue", companyType: "央企", companyNature: "通信服务", batch: "秋招", title: "云岭通信集团2027届校园招聘", intro: "通信网络、软件研发、项目交付与综合管理方向招聘。", graduationYears: ["2027"], degrees: ["本科", "硕士"], originalMajors: "通信工程、电子信息、计算机、自动化等相关专业", majors: ["通信工程", "电子信息工程", "计算机科学与技术", "自动化"], majorCategory: ["工学"], relatedMajor: true, noMajorLimit: false, regions: ["北京", "西安", "全国"], publishedAt: "2026-08-06", startAt: "2026-08-12", deadline: "2026-08-29", status: "upcoming", sourceName: "云岭通信招聘官网", sourceLevel: "A级", verifiedAt: "2026-08-06", link: "https://example.com/yunling-telecom", opportunityType: "CENTRAL_SOE" },
  { id: "p22", company: "东澜港口集团", shortName: "东澜港口", logoTone: "teal", companyType: "地方国企", companyNature: "港口物流", batch: "春招", title: "东澜港口集团2027届春季招聘", intro: "港口运营、物流管理、工程技术与数字化岗位，面向应届毕业生开放。", graduationYears: ["2027"], degrees: ["本科", "硕士"], originalMajors: "物流管理、机械、电气、计算机、工商管理", majors: ["物流管理", "机械工程", "电气工程及其自动化", "计算机科学与技术", "工商管理"], majorCategory: ["工学", "管理学"], relatedMajor: true, noMajorLimit: false, regions: ["宁波", "厦门", "青岛"], publishedAt: "2026-08-05", startAt: "2026-08-07", deadline: "2026-08-24", status: "recruiting", sourceName: "东澜港口招聘官网", sourceLevel: "A级", verifiedAt: "2026-08-05", link: "https://example.com/donglan-port", opportunityType: "LOCAL_SOE" },
  { id: "p23", company: "极昼智能", shortName: "极昼智能", logoTone: "violet", companyType: "科技企业", companyNature: "人工智能", batch: "秋招", title: "极昼智能2027届算法与产品招聘", intro: "算法、数据、产品与工程岗位，支持多城市办公。", graduationYears: ["2027"], degrees: ["本科", "硕士", "博士"], originalMajors: "计算机、人工智能、数学、统计、电子信息等相关专业", majors: ["计算机科学与技术", "人工智能", "数据科学与大数据技术"], majorCategory: ["工学", "理学"], relatedMajor: true, noMajorLimit: false, regions: ["北京", "上海", "深圳"], publishedAt: "2026-08-06", startAt: "2026-08-13", deadline: "2026-09-12", status: "upcoming", sourceName: "极昼智能招聘官网", sourceLevel: "A级", verifiedAt: "2026-08-06", link: "https://example.com/jizhou-ai", opportunityType: "ENTERPRISE_CAMPUS" },
  { id: "p24", company: "启明消费金融", shortName: "启明金融", logoTone: "red", companyType: "金融企业", companyNature: "消费金融", batch: "秋招", title: "启明消费金融2027届校招", intro: "风险管理、数据分析、金融科技与运营岗位。", graduationYears: ["2027"], degrees: ["本科", "硕士"], originalMajors: "金融、经济、数学统计、计算机、法律等专业优先", majors: ["金融学", "经济学", "计算机科学与技术", "法学"], majorCategory: ["经济学", "工学", "法学"], relatedMajor: true, noMajorLimit: false, regions: ["上海", "杭州", "深圳"], publishedAt: "2026-08-04", startAt: "2026-08-09", deadline: "2026-08-27", status: "recruiting", sourceName: "启明消费金融招聘官网", sourceLevel: "A级", verifiedAt: "2026-08-04", link: "https://example.com/qiming-finance", opportunityType: "ENTERPRISE_CAMPUS" },
  { id: "p25", company: "安拓新能源", shortName: "安拓能源", logoTone: "green", companyType: "制造业企业", companyNature: "新能源装备", batch: "招满即止", title: "安拓新能源2027届技术岗位招聘", intro: "储能、电气、机械和质量工程岗位，招满即止，建议尽早查看官方页面。", graduationYears: ["2027"], degrees: ["本科", "硕士"], originalMajors: "电气、机械、自动化、材料、能源动力相关专业", majors: ["电气工程及其自动化", "机械工程", "自动化"], majorCategory: ["工学"], relatedMajor: true, noMajorLimit: false, regions: ["合肥", "苏州", "武汉"], publishedAt: "2026-08-06", startAt: "2026-08-06", deadline: "", deadlineType: "UNTIL_FILLED", status: "recruiting", sourceName: "安拓新能源招聘官网", sourceLevel: "A级", verifiedAt: "2026-08-06", link: "https://example.com/antuo-energy", opportunityType: "ENTERPRISE_CAMPUS" },
  { id: "p26", company: "北辰装备研究院", shortName: "北辰研究院", logoTone: "slate", companyType: "央企", companyNature: "装备研发", batch: "时间待公布", title: "北辰装备研究院2027届校园招聘", intro: "公告已发布，报名时间待官方进一步通知，平台不生成虚假截止日期。", graduationYears: ["2027"], degrees: ["硕士", "博士"], originalMajors: "机械、材料、电气、控制、计算机等相关专业", majors: ["机械工程", "电气工程及其自动化", "自动化", "计算机科学与技术"], majorCategory: ["工学"], relatedMajor: true, noMajorLimit: false, regions: ["北京", "沈阳", "哈尔滨"], publishedAt: "2026-08-06", startAt: "", deadline: "", deadlineType: "NOT_ANNOUNCED", status: "upcoming", sourceName: "北辰装备研究院官网", sourceLevel: "A级", verifiedAt: "2026-08-06", link: "https://example.com/beichen-lab", opportunityType: "CENTRAL_SOE" },
  { id: "p27", company: "嘉实保险科技", shortName: "嘉实保险", logoTone: "amber", companyType: "知名企业", companyNature: "保险科技", batch: "秋招", title: "嘉实保险科技2027届数据与运营招聘", intro: "数据分析、精算支持、产品运营与客户服务方向。", graduationYears: ["2027"], degrees: ["本科", "硕士"], originalMajors: "不限专业，数学、统计、经济、金融、计算机优先", majors: ["金融学", "经济学", "数据科学与大数据技术", "计算机科学与技术"], majorCategory: ["经济学", "理学", "工学"], relatedMajor: true, noMajorLimit: true, regions: ["北京", "上海", "广州"], publishedAt: "2026-08-03", startAt: "2026-08-08", deadline: "2026-08-20", status: "ending", sourceName: "嘉实保险科技招聘官网", sourceLevel: "A级", verifiedAt: "2026-08-05", link: "https://example.com/jiashi-insure", opportunityType: "ENTERPRISE_CAMPUS" },
  { id: "p28", company: "南川公共服务集团", shortName: "南川公服", logoTone: "orange", companyType: "地方国企", companyNature: "公共服务", batch: "秋招", title: "南川公共服务集团2027届法务与管理招聘", intro: "法务合规、人力资源、行政管理与项目管理方向招聘。", graduationYears: ["2027"], degrees: ["本科", "硕士"], originalMajors: "法学、工商管理、人力资源管理、公共事业管理", majors: ["法学", "工商管理", "人力资源管理"], majorCategory: ["法学", "管理学"], relatedMajor: true, noMajorLimit: false, regions: ["成都", "重庆", "南宁"], publishedAt: "2026-08-01", startAt: "2026-08-10", deadline: "2026-08-23", status: "recruiting", sourceName: "南川公共服务集团官网", sourceLevel: "A级", verifiedAt: "2026-08-04", link: "https://example.com/nanchuan-public", opportunityType: "LOCAL_SOE" },
  { id: "p29", company: "微光内容实验室", shortName: "微光内容", logoTone: "rose", companyType: "知名企业", companyNature: "文化内容", batch: "春招", title: "微光内容实验室2027届内容与品牌招聘", intro: "内容策划、品牌、公关与视频方向，欢迎优秀作品集。", graduationYears: ["2027"], degrees: ["本科", "硕士"], originalMajors: "新闻传播、汉语言文学、广告学、设计、市场营销优先", majors: ["新闻传播学", "汉语言文学", "市场营销"], majorCategory: ["文学", "管理学"], relatedMajor: true, noMajorLimit: false, regions: ["北京", "上海", "广州"], publishedAt: "2026-08-02", startAt: "2026-08-06", deadline: "2026-08-19", status: "ending", sourceName: "微光内容官方招聘账号", sourceLevel: "B级", verifiedAt: "2026-08-05", link: "https://example.com/weiguang-content", opportunityType: "ENTERPRISE_CAMPUS" },
  { id: "p30", company: "华岭电网服务", shortName: "华岭电网", logoTone: "emerald", companyType: "央企", companyNature: "电网服务", batch: "秋招", title: "华岭电网服务2027届电气类招聘", intro: "输变电工程、调度通信、数字化运维与安全管理岗位。", graduationYears: ["2027"], degrees: ["本科", "硕士"], originalMajors: "电气工程、自动化、通信工程、计算机、安全工程", majors: ["电气工程及其自动化", "自动化", "通信工程", "计算机科学与技术"], majorCategory: ["工学"], relatedMajor: false, noMajorLimit: false, regions: ["郑州", "武汉", "长沙", "全国"], publishedAt: "2026-08-05", startAt: "2026-08-11", deadline: "2026-09-03", status: "upcoming", sourceName: "华岭电网服务招聘官网", sourceLevel: "A级", verifiedAt: "2026-08-05", link: "https://example.com/hualing-grid", opportunityType: "CENTRAL_SOE" },
];

demoProjects.push(...additionalDemoProjects);

export const projects = realProjects;

export const notificationSeed = [
  { id: "n1", icon: "⏰", title: "华辰能源集团报名截止提醒", text: "还有 12 天截止，记得补齐网申材料。", time: "今天 09:24", unread: true, color: "orange" },
  { id: "n2", icon: "✓", title: "星河云计算招聘已开始", text: "你收藏的项目已开放报名，点击查看官方入口。", time: "昨天 18:40", unread: true, color: "teal" },
  { id: "n3", icon: "↻", title: "望潮证券信息已核验", text: "报名截止时间更新为 2026 年 8 月 13 日。", time: "08月05日", unread: false, color: "blue" },
  { id: "n4", icon: "⚑", title: "你有 3 个项目等待跟进", text: "建议优先处理 7 天内截止的招聘项目。", time: "08月04日", unread: false, color: "violet" },
];

export const majorOptions = [
  { category: "工学", majors: ["计算机科学与技术", "软件工程", "人工智能", "数据科学与大数据技术", "电子信息工程", "通信工程", "自动化", "机械工程", "电气工程及其自动化", "土木工程"] },
  { category: "经济学", majors: ["金融学", "经济学"] },
  { category: "管理学", majors: ["工商管理", "市场营销", "会计学", "财务管理", "人力资源管理"] },
  { category: "法学", majors: ["法学"] },
  { category: "文学", majors: ["汉语言文学", "新闻传播学"] },
];

export const regionOptions = ["全国", "北京", "上海", "深圳", "杭州", "广州", "成都", "武汉", "南京", "苏州"];

export const statusLabel: Record<ProjectStatus, string> = {
  recruiting: "招聘中",
  upcoming: "即将开始",
  ending: "即将截止",
  closed: "已截止",
};

export const statusClass: Record<ProjectStatus, string> = {
  recruiting: "status-live",
  upcoming: "status-soon",
  ending: "status-ending",
  closed: "status-closed",
};

export function getMatch(project: Project, userMajor = "计算机科学与技术"): MatchLevel {
  if (project.noMajorLimit) return "不限专业";
  if (project.majors.includes(userMajor)) return "明确匹配";
  if (project.majorCategory.some((category) => userMajorCategory(userMajor) === category)) return "专业大类匹配";
  if (project.relatedMajor) return "可能匹配";
  return "暂无匹配依据";
}

export type MatchExplanation = {
  level: MatchLevel;
  evidence: string;
  needsManualReview: boolean;
  risk: string;
};

export function explainMatch(project: Project, userMajor = "计算机科学与技术"): MatchExplanation {
  if (project.noMajorLimit) {
    return { level: "不限专业", evidence: "该招聘项目公开信息中标注为专业不限。", needsManualReview: false, risk: "仍需核对具体岗位是否有隐藏专业要求。" };
  }
  if (project.majors.includes(userMajor)) {
    return { level: "明确匹配", evidence: `招聘要求包含“${userMajor}”，与你填写的专业一致。`, needsManualReview: false, risk: "最终报名资格以招聘单位审核为准。" };
  }
  if (project.majorCategory.some((category) => userMajorCategory(userMajor) === category)) {
    return { level: "专业大类匹配", evidence: `招聘要求覆盖“${userMajorCategory(userMajor)}”，你填写的“${userMajor}”归属于该专业大类。`, needsManualReview: false, risk: "请打开官方公告核对具体专业目录和岗位限制。" };
  }
  if (project.relatedMajor) {
    return { level: "可能匹配", evidence: `招聘原文包含“相关专业”等宽泛表述，系统无法确认“${userMajor}”是否被招聘单位接受。`, needsManualReview: true, risk: "建议查看官方公告或咨询招聘单位。" };
  }
  return { level: "暂无匹配依据", evidence: "当前招聘原文中没有找到与你专业直接对应的标准标签。", needsManualReview: true, risk: "不要仅凭平台结果判断报名资格。" };
}

function userMajorCategory(major: string) {
  return majorOptions.find((group) => group.majors.includes(major))?.category ?? "";
}

export function formatDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "时间待公布";
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function formatDateWithWeekday(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return formatDate(date);
  const value = new Date(`${date}T00:00:00`);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][value.getDay()];
  return `${formatDate(date)} 周${weekday}`;
}
