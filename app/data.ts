import { realProjects } from "./real-projects";
import { majorOptions } from "./major-directory";
import { isFixedConfirmedDeadline } from "../lib/reminders/deadline";

export type BrandConfig = {
  name: string;
  logoText: string;
  edition: string;
  homeTitle: string;
  homeSubtitle: string;
  marketingCopy: string;
  disclaimer: string;
  cutoffDays: number;
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
};

export type ProjectStatus = "recruiting" | "upcoming" | "ending" | "closed";
export type MatchLevel = "明确匹配" | "专业大类匹配" | "不限专业" | "可能匹配" | "暂无匹配依据";
export type OpportunityType = "ENTERPRISE_CAMPUS" | "CENTRAL_SOE" | "LOCAL_SOE" | "NATIONAL_CIVIL_SERVICE" | "PROVINCIAL_CIVIL_SERVICE" | "SELECTED_GRADUATE" | "PUBLIC_INSTITUTION" | "MILITARY_CIVILIAN" | "BANK_CAMPUS" | "OTHER";
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
  recruitmentSeason?: string;
  deadlineType?: DeadlineType;
  opportunityRelevanceStatus?: "CURRENT_OPEN" | "UPCOMING" | "RECENT_CLOSED" | "HISTORICAL" | "PUBLIC_NOTICE" | "RESULT_NOTICE" | "NOT_AN_OPPORTUNITY";
  displayType?: "RECRUITMENT_PROJECT" | "OFFICIAL_RECRUITMENT_ENTRY";
  sourceLinkStatus?: string;
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
  recordStatus?: "真实数据";
};

export const projects = realProjects;
export const notificationSeed: Array<{ id: string; icon: string; title: string; text: string; time: string; unread: boolean; color: string }> = [];
export { majorOptions };

export function hasExplicitDeadline(project: Project): boolean {
  const deadlineType = project.deadlineType ?? (project.deadline ? "FIXED_DATE" : "NOT_ANNOUNCED");
  return isFixedConfirmedDeadline(deadlineType, project.deadline);
}

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
