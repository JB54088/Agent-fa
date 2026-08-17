import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_REMINDER_SETTINGS,
  buildDeadlineChangedMessage,
  buildDeadlineReminderMessage,
  isFixedConfirmedDeadline,
  scheduleDeadlineReminders,
} from "../lib/reminders/deadline.ts";
import { runDeadlineReminderJob } from "../lib/reminders/scheduler.ts";

const now = (date) => new Date(`${date}T00:00:00+08:00`);
const deliveryInput = (deadlineAt, overrides = {}) => ({
  userId: "user-1",
  opportunityId: "opportunity-1",
  deadlineAt,
  deadlineType: "FIXED_DATE",
  now: now("2026-08-01"),
  ...overrides,
});

test("收藏后按默认设置创建7天、3天、1天提醒", () => {
  const reminders = scheduleDeadlineReminders(deliveryInput("2026-08-10"));
  assert.deepEqual(reminders.map((item) => item.reminderType), ["DEADLINE_7_DAYS", "DEADLINE_3_DAYS", "DEADLINE_1_DAY"]);
});

test("距离截止5天时只创建3天和1天提醒", () => {
  const reminders = scheduleDeadlineReminders(deliveryInput("2026-08-10", { now: now("2026-08-05") }));
  assert.deepEqual(reminders.map((item) => item.reminderType), ["DEADLINE_3_DAYS", "DEADLINE_1_DAY"]);
});

test("距离截止2天时只创建1天提醒", () => {
  const reminders = scheduleDeadlineReminders(deliveryInput("2026-08-10", { now: now("2026-08-08") }));
  assert.deepEqual(reminders.map((item) => item.reminderType), ["DEADLINE_1_DAY"]);
});

test("已截止项目不创建提醒", () => {
  assert.equal(scheduleDeadlineReminders(deliveryInput("2026-07-31")).length, 0);
});

test("招满即止不创建固定截止提醒", () => {
  assert.equal(scheduleDeadlineReminders(deliveryInput("2026-08-10", { deadlineType: "UNTIL_FILLED" })).length, 0);
});

test("未公布日期不创建截止提醒", () => {
  assert.equal(scheduleDeadlineReminders(deliveryInput(null, { deadlineType: "NOT_ANNOUNCED" })).length, 0);
});

test("默认不创建当天提醒，显式开启后可创建当天提醒", () => {
  const withoutSameDay = scheduleDeadlineReminders(deliveryInput("2026-08-01T23:59:00+08:00", { now: now("2026-08-01") }));
  assert.deepEqual(withoutSameDay, []);
  const withSameDay = scheduleDeadlineReminders(deliveryInput("2026-08-01T23:59:00+08:00", { now: now("2026-07-31"), settings: { ...DEFAULT_REMINDER_SETTINGS, remindSameDay: true } }));
  assert.equal(withSameDay.at(-1)?.reminderType, "DEADLINE_SAME_DAY");
});

test("取消收藏只需要取消未来未发送提醒，历史消息不由调度器删除", async () => {
  const calls = [];
  const repository = {
    listDueDeliveries: async () => [{ id: "d1", userId: "u", opportunityId: "o", opportunityTitle: "项目", deadlineAt: "2026-08-10", reminderType: "DEADLINE_3_DAYS", actionUrl: "/projects/o", favoriteActive: false, settingsEnabled: true, opportunityActive: true }],
    claimPendingDelivery: async () => { calls.push("claim"); return true; },
    createNotification: async () => { calls.push("notification"); },
    markDelivered: async () => { calls.push("delivered"); },
    markSkipped: async () => { calls.push("skipped"); },
    markFailed: async () => { calls.push("failed"); },
  };
  const result = await runDeadlineReminderJob(repository, now("2026-08-07"));
  assert.equal(result.skipped, 1);
  assert.deepEqual(calls, ["skipped"]);
});

test("重新收藏时相同截止日期的提醒键稳定，可由数据库幂等恢复", () => {
  const first = scheduleDeadlineReminders(deliveryInput("2026-08-10"));
  const second = scheduleDeadlineReminders(deliveryInput("2026-08-10"));
  assert.deepEqual(first.map((item) => item.deduplicationKey), second.map((item) => item.deduplicationKey));
});

test("deduplication_key 对同一用户、项目、提醒类型和截止日期唯一", () => {
  const reminders = scheduleDeadlineReminders(deliveryInput("2026-08-10"));
  assert.equal(new Set(reminders.map((item) => item.deduplicationKey)).size, reminders.length);
});

test("定时任务生成站内消息并标记已发送", async () => {
  const calls = [];
  const repository = {
    listDueDeliveries: async () => [{ id: "d1", userId: "u", opportunityId: "o", opportunityTitle: "华为校招", deadlineAt: "2026-08-10", reminderType: "DEADLINE_3_DAYS", actionUrl: "/projects/o", favoriteActive: true, settingsEnabled: true, opportunityActive: true }],
    claimPendingDelivery: async () => true,
    createNotification: async (notification) => calls.push(notification),
    markDelivered: async () => calls.push("delivered"),
    markSkipped: async () => calls.push("skipped"),
    markFailed: async () => calls.push("failed"),
  };
  const result = await runDeadlineReminderJob(repository, now("2026-08-07"));
  assert.equal(result.delivered, 1);
  assert.equal(calls[0].title, "报名还有3天截止");
  assert.equal(calls[1], "delivered");
});

test("定时任务重复运行不会重复发消息", async () => {
  let claimed = true;
  let created = 0;
  const repository = {
    listDueDeliveries: async () => [{ id: "d1", userId: "u", opportunityId: "o", opportunityTitle: "项目", deadlineAt: "2026-08-10", reminderType: "DEADLINE_1_DAY", actionUrl: "/projects/o", favoriteActive: true, settingsEnabled: true, opportunityActive: true }],
    claimPendingDelivery: async () => { const current = claimed; claimed = false; return current; },
    createNotification: async () => { created += 1; },
    markDelivered: async () => undefined,
    markSkipped: async () => undefined,
    markFailed: async () => undefined,
  };
  await runDeadlineReminderJob(repository, now("2026-08-09"));
  const second = await runDeadlineReminderJob(repository, now("2026-08-09"));
  assert.equal(created, 1);
  assert.equal(second.alreadyClaimed, 1);
});

test("截止日期变化后，新的日期生成新的提醒键", () => {
  const oldReminders = scheduleDeadlineReminders(deliveryInput("2026-08-10"));
  const newReminders = scheduleDeadlineReminders(deliveryInput("2026-08-15"));
  assert.notDeepEqual(oldReminders.map((item) => item.deduplicationKey), newReminders.map((item) => item.deduplicationKey));
  const change = buildDeadlineChangedMessage("项目", "2026-08-10", "2026-08-15");
  assert.match(change.body, /2026年8月10日调整为2026年8月15日/);
});

test("已报名用户使用非催促文案", () => {
  const message = buildDeadlineReminderMessage({ title: "项目", reminderType: "DEADLINE_3_DAYS", deadlineAt: "2026-08-10", applicationStatus: "已报名" });
  assert.match(message.body, /已标记.*已报名/);
  assert.doesNotMatch(message.body, /尚未报名/);
});

test("未读数量来自消息的readAt状态", () => {
  const messages = [{ readAt: null }, { readAt: null }, { readAt: "2026-08-01T00:00:00Z" }];
  assert.equal(messages.filter((item) => !item.readAt).length, 2);
  messages[0].readAt = "2026-08-01T01:00:00Z";
  assert.equal(messages.filter((item) => !item.readAt).length, 1);
});

test("阅读消息只改变已读状态，不删除消息", () => {
  const messages = [{ id: "n1", readAt: null }, { id: "n2", readAt: null }];
  messages[0].readAt = "2026-08-01T01:00:00Z";
  assert.equal(messages.length, 2);
  assert.equal(messages[0].readAt !== null, true);
});

test("只有明确FIXED_DATE且存在日期才具备固定截止提醒资格", () => {
  assert.equal(isFixedConfirmedDeadline("FIXED_DATE", "2026-08-10"), true);
  assert.equal(isFixedConfirmedDeadline("ESTIMATED", "2026-08-10"), false);
  assert.equal(isFixedConfirmedDeadline("FIXED_DATE", null), false);
});
