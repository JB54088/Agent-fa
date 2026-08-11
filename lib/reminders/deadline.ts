export const REMINDER_TIME_ZONE = "Asia/Shanghai";
export const DEFAULT_REMINDER_DAYS = [7, 3, 1] as const;

export type DeadlineType = "FIXED_DATE" | "UNTIL_FILLED" | "NOT_ANNOUNCED" | "LONG_TERM" | "ESTIMATED" | "OTHER";
export type ReminderType = "DEADLINE_7_DAYS" | "DEADLINE_3_DAYS" | "DEADLINE_1_DAY" | "DEADLINE_SAME_DAY";
export type ApplicationProgress = string | null | undefined;

export type ReminderSettings = {
  remind7Days: boolean;
  remind3Days: boolean;
  remind1Day: boolean;
  remindSameDay: boolean;
  changeNotificationEnabled: boolean;
  enabled: boolean;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  remind7Days: true,
  remind3Days: true,
  remind1Day: true,
  remindSameDay: false,
  changeNotificationEnabled: true,
  enabled: true,
};

export type ScheduledDeadlineReminder = {
  reminderType: ReminderType;
  scheduledAt: Date;
  deadlineAt: Date;
  deadlineDate: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET = "+08:00";

export function isFixedConfirmedDeadline(deadlineType: string | null | undefined, deadlineAt: string | Date | null | undefined): boolean {
  return deadlineType === "FIXED_DATE" && parseDeadlineAt(deadlineAt) !== null;
}

export function parseDeadlineAt(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999${SHANGHAI_OFFSET}`)
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isDateOnly(value: string | Date | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatShanghaiDate(value: string | Date): string {
  const date = parseDeadlineAt(value);
  if (!date) return "时间待确认";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatShanghaiDateKey(value: string | Date): string {
  const date = parseDeadlineAt(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function addCalendarDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateOnlyReminderTime(deadlineDate: string, daysBefore: number): Date {
  const reminderDate = addCalendarDays(deadlineDate, -daysBefore);
  return new Date(`${reminderDate}T09:00:00.000${SHANGHAI_OFFSET}`);
}

function sameDayReminderTime(deadlineDate: string): Date {
  return new Date(`${deadlineDate}T09:00:00.000${SHANGHAI_OFFSET}`);
}

function reminderTypeForDays(days: number): ReminderType {
  if (days === 7) return "DEADLINE_7_DAYS";
  if (days === 3) return "DEADLINE_3_DAYS";
  if (days === 1) return "DEADLINE_1_DAY";
  return "DEADLINE_SAME_DAY";
}

function isEnabled(settings: ReminderSettings, days: number): boolean {
  if (days === 7) return settings.remind7Days;
  if (days === 3) return settings.remind3Days;
  if (days === 1) return settings.remind1Day;
  return settings.remindSameDay;
}

export function scheduleDeadlineReminders({
  userId,
  opportunityId,
  deadlineAt: rawDeadlineAt,
  deadlineType,
  settings = DEFAULT_REMINDER_SETTINGS,
  now = new Date(),
}: {
  userId: string;
  opportunityId: string;
  deadlineAt: string | Date | null | undefined;
  deadlineType: string | null | undefined;
  settings?: ReminderSettings;
  now?: Date;
}): Array<ScheduledDeadlineReminder & { deduplicationKey: string; userId: string; opportunityId: string }> {
  const deadlineAt = parseDeadlineAt(rawDeadlineAt);
  if (!settings.enabled || deadlineType !== "FIXED_DATE" || !deadlineAt || deadlineAt.getTime() <= now.getTime()) return [];

  const deadlineDate = formatShanghaiDateKey(deadlineAt);
  const result: Array<ScheduledDeadlineReminder & { deduplicationKey: string; userId: string; opportunityId: string }> = [];
  for (const days of DEFAULT_REMINDER_DAYS) {
    if (!isEnabled(settings, days)) continue;
    const scheduledAt = isDateOnly(rawDeadlineAt)
      ? dateOnlyReminderTime(deadlineDate, days)
      : new Date(deadlineAt.getTime() - days * DAY_MS);
    if (scheduledAt.getTime() <= now.getTime()) continue;
    const reminderType = reminderTypeForDays(days);
    result.push({
      userId,
      opportunityId,
      reminderType,
      scheduledAt,
      deadlineAt,
      deadlineDate,
      deduplicationKey: `${userId}-${opportunityId}-${reminderType}-${deadlineDate}`,
    });
  }

  if (settings.remindSameDay) {
    const scheduledAt = isDateOnly(rawDeadlineAt) ? sameDayReminderTime(deadlineDate) : sameDayReminderTime(deadlineDate);
    if (scheduledAt.getTime() <= now.getTime() && deadlineAt.getTime() > now.getTime()) {
      scheduledAt.setTime(now.getTime() + 60 * 1000);
    }
    if (scheduledAt.getTime() > now.getTime() && scheduledAt.getTime() < deadlineAt.getTime()) {
      result.push({
        userId,
        opportunityId,
        reminderType: "DEADLINE_SAME_DAY",
        scheduledAt,
        deadlineAt,
        deadlineDate,
        deduplicationKey: `${userId}-${opportunityId}-DEADLINE_SAME_DAY-${deadlineDate}`,
      });
    }
  }
  return result;
}

export function buildDeadlineReminderMessage({
  title,
  reminderType,
  deadlineAt,
  applicationStatus,
}: {
  title: string;
  reminderType: ReminderType;
  deadlineAt: string | Date;
  applicationStatus?: ApplicationProgress;
}): { title: string; body: string; category: "DEADLINE_REMINDER" } {
  const deadline = formatShanghaiDate(deadlineAt);
  const applied = ["已报名", "APPLIED", "ASSESSMENT_COMPLETED", "WRITTEN_EXAM", "INTERVIEW", "OFFER", "ENDED"].includes(applicationStatus ?? "");
  if (reminderType === "DEADLINE_7_DAYS") {
    return {
      title: "报名还有7天截止",
      body: applied ? `你已标记「${title}」为已报名，该招聘将在7天后截止。如需修改报名信息，请及时查看官方页面。` : `你收藏的「${title}」将在${deadline}截止，建议提前准备报名材料。`,
      category: "DEADLINE_REMINDER",
    };
  }
  if (reminderType === "DEADLINE_3_DAYS") {
    return {
      title: "报名还有3天截止",
      body: applied ? `你已标记「${title}」为已报名，该招聘将在3天后截止。如需修改报名信息，请及时查看官方页面。` : `你收藏的「${title}」还有3天截止，尚未报名的话建议尽快处理。`,
      category: "DEADLINE_REMINDER",
    };
  }
  if (reminderType === "DEADLINE_1_DAY") {
    return {
      title: "明天截止报名",
      body: applied ? `你已标记「${title}」为已报名，该招聘明天截止。如需修改报名信息，请及时查看官方页面。` : `你收藏的「${title}」将于明天截止报名，请及时前往官方渠道确认并提交。`,
      category: "DEADLINE_REMINDER",
    };
  }
  return {
    title: "今天截止报名",
    body: `你收藏的「${title}」今天截止，请以官方招聘页面最新时间为准。`,
    category: "DEADLINE_REMINDER",
  };
}

export function buildDeadlineChangedMessage(title: string, oldDeadline: string | Date, newDeadline: string | Date) {
  return {
    title: "招聘截止时间已调整",
    body: `你收藏的「${title}」截止时间已由${formatShanghaiDate(oldDeadline)}调整为${formatShanghaiDate(newDeadline)}，请以官方公告为准。`,
    category: "OPPORTUNITY_CHANGE" as const,
  };
}
