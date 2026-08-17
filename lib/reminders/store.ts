import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "../../db";
import { DEFAULT_REMINDER_SETTINGS, scheduleDeadlineReminders, type ReminderSettings } from "./deadline.ts";
import type { ReminderJobRepository } from "./scheduler";

export type FavoriteReminderResult = {
  favorite: boolean;
  reminderSettings: ReminderSettings;
  scheduledReminderTypes: string[];
  message: string;
};

export type ReminderStore = {
  favoriteOpportunity: (input: { userEmail: string; opportunityId: string }) => Promise<FavoriteReminderResult>;
  unfavoriteOpportunity: (input: { userEmail: string; opportunityId: string }) => Promise<{ favorite: false; cancelledDeliveries: number }>;
  getReminderSettings: (input: { userEmail: string; opportunityId: string }) => Promise<ReminderSettings | null>;
  updateReminderSettings: (input: { userEmail: string; opportunityId: string; patch: Partial<ReminderSettings> }) => Promise<ReminderSettings>;
  listNotifications: (input: { userEmail: string; unreadOnly?: boolean }) => Promise<Array<{ id: string; opportunityId: string | null; type: string; title: string; body: string; actionUrl: string | null; readAt: string | null; createdAt: string }>>;
  markNotificationRead: (input: { userEmail: string; notificationId: string }) => Promise<void>;
  reminderJobRepository: () => ReminderJobRepository;
};

type SqlClient = ReturnType<typeof neon<false, false>>;

let ensured = false;

async function ensureReminderColumns(sql: SqlClient) {
  if (ensured) return;
  await sql`ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS claimed_at timestamptz`;
  ensured = true;
}

async function userIdForEmail(sql: SqlClient, email: string) {
  const rows = await sql`SELECT id::text AS id FROM users WHERE email = ${email} LIMIT 1`;
  if (!rows[0]?.id) throw new Error("user_not_found");
  return String(rows[0].id);
}

function settingsFromRow(row: Record<string, unknown> | undefined): ReminderSettings {
  return {
    remind7Days: row?.remind_7_days !== false,
    remind3Days: row?.remind_3_days !== false,
    remind1Day: row?.remind_1_day !== false,
    remindSameDay: row?.remind_same_day === true,
    changeNotificationEnabled: row?.change_notification_enabled !== false,
    enabled: row?.enabled !== false,
  };
}

async function readOpportunity(sql: SqlClient, opportunityId: string) {
  const rows = await sql`
    SELECT id::text AS id, title, deadline_at, deadline_type, publication_status, calculated_status
    FROM opportunities WHERE id = ${opportunityId} LIMIT 1
  `;
  if (!rows[0]) throw new Error("opportunity_not_found");
  return rows[0] as Record<string, unknown>;
}

async function readSettings(sql: SqlClient, userId: string, opportunityId: string) {
  const rows = await sql`
    SELECT remind_7_days, remind_3_days, remind_1_day, remind_same_day,
           change_notification_enabled, enabled
    FROM opportunity_reminder_settings
    WHERE user_id = ${userId} AND opportunity_id = ${opportunityId}
    LIMIT 1
  `;
  return settingsFromRow(rows[0] as Record<string, unknown> | undefined);
}

async function scheduleForFavorite(sql: SqlClient, userId: string, opportunityId: string, settings: ReminderSettings, now = new Date()) {
  const opportunity = await readOpportunity(sql, opportunityId);
  const scheduled = scheduleDeadlineReminders({
    userId,
    opportunityId,
    deadlineAt: opportunity.deadline_at as string | Date | null,
    deadlineType: String(opportunity.deadline_type ?? ""),
    settings,
    now,
  });
  for (const item of scheduled) {
    await sql`
      INSERT INTO notification_deliveries (
        id, user_id, opportunity_id, reminder_type, channel, scheduled_at,
        delivery_status, deduplication_key
      ) VALUES (
        gen_random_uuid(), ${item.userId}, ${item.opportunityId}, ${item.reminderType}, 'in_app',
        ${item.scheduledAt}, 'pending', ${item.deduplicationKey}
      ) ON CONFLICT (deduplication_key) DO UPDATE SET
        scheduled_at = EXCLUDED.scheduled_at,
        delivery_status = CASE WHEN notification_deliveries.delivery_status = 'delivered' THEN notification_deliveries.delivery_status ELSE 'pending' END,
        claimed_at = NULL,
        failure_reason = NULL,
        updated_at = now()
    `;
  }
  return scheduled;
}

/** Rebuilds future deadline deliveries for every active favorite of an opportunity. */
export async function syncFavoriteOpportunityReminders(opportunityId: string) {
  const sql = neon(getDatabaseUrl());
  await ensureReminderColumns(sql);
  const rows = await sql`
    SELECT f.user_id::text AS user_id, s.remind_7_days, s.remind_3_days, s.remind_1_day,
           s.remind_same_day, s.change_notification_enabled, s.enabled
    FROM opportunity_favorites f
    LEFT JOIN opportunity_reminder_settings s
      ON s.user_id = f.user_id AND s.opportunity_id = f.opportunity_id
    WHERE f.opportunity_id = ${opportunityId} AND f.deleted_at IS NULL
  `;
  let scheduled = 0;
  for (const row of rows) {
    scheduled += (await scheduleForFavorite(sql, String(row.user_id), opportunityId, settingsFromRow(row as Record<string, unknown>))).length;
  }
  return { favorites: rows.length, scheduled };
}

function makeStore(): ReminderStore {
  const sql = neon(getDatabaseUrl());

  async function favoriteOpportunity({ userEmail, opportunityId }: { userEmail: string; opportunityId: string }) {
    await ensureReminderColumns(sql);
    const userId = await userIdForEmail(sql, userEmail);
    await readOpportunity(sql, opportunityId);
    await sql`
      INSERT INTO opportunity_favorites (user_id, opportunity_id, created_at, updated_at, deleted_at)
      VALUES (${userId}, ${opportunityId}, now(), now(), NULL)
      ON CONFLICT (user_id, opportunity_id) DO UPDATE SET deleted_at = NULL, updated_at = now()
    `;
    await sql`
      INSERT INTO opportunity_reminder_settings (
        id, user_id, opportunity_id, remind_7_days, remind_3_days, remind_1_day,
        remind_same_day, before_days, event_types, change_notification_enabled,
        auto_created, enabled, created_at, updated_at, deleted_at
      ) VALUES (
        gen_random_uuid(), ${userId}, ${opportunityId}, true, true, true, false,
        '[7,3,1]'::jsonb, '["DEADLINE"]'::jsonb, true, true, true, now(), now(), NULL
      ) ON CONFLICT (user_id, opportunity_id) DO UPDATE SET deleted_at = NULL, updated_at = now()
    `;
    const settings = await readSettings(sql, userId, opportunityId);
    const scheduled = await scheduleForFavorite(sql, userId, opportunityId, settings);
    return { favorite: true, reminderSettings: settings, scheduledReminderTypes: scheduled.map((item) => item.reminderType), message: scheduled.length ? "已收藏，并已同步报名截止提醒" : "已收藏；当前没有明确的报名截止时间" };
  }

  async function unfavoriteOpportunity({ userEmail, opportunityId }: { userEmail: string; opportunityId: string }) {
    await ensureReminderColumns(sql);
    const userId = await userIdForEmail(sql, userEmail);
    await sql`UPDATE opportunity_favorites SET deleted_at = now(), updated_at = now() WHERE user_id = ${userId} AND opportunity_id = ${opportunityId}`;
    const result = await sql`
      UPDATE notification_deliveries SET delivery_status = 'cancelled', updated_at = now()
      WHERE user_id = ${userId} AND opportunity_id = ${opportunityId} AND delivery_status = 'pending'
      RETURNING id
    `;
    return { favorite: false as const, cancelledDeliveries: result.length };
  }

  async function getReminderSettings({ userEmail, opportunityId }: { userEmail: string; opportunityId: string }) {
    const userId = await userIdForEmail(sql, userEmail);
    const rows = await sql`SELECT remind_7_days, remind_3_days, remind_1_day, remind_same_day, change_notification_enabled, enabled FROM opportunity_reminder_settings WHERE user_id = ${userId} AND opportunity_id = ${opportunityId} AND deleted_at IS NULL LIMIT 1`;
    return rows[0] ? settingsFromRow(rows[0] as Record<string, unknown>) : null;
  }

  async function updateReminderSettings({ userEmail, opportunityId, patch }: { userEmail: string; opportunityId: string; patch: Partial<ReminderSettings> }) {
    await ensureReminderColumns(sql);
    const userId = await userIdForEmail(sql, userEmail);
    await readOpportunity(sql, opportunityId);
    const current = await readSettings(sql, userId, opportunityId);
    const next = { ...current, ...patch };
    await sql`
      INSERT INTO opportunity_reminder_settings (
        id, user_id, opportunity_id, remind_7_days, remind_3_days, remind_1_day,
        remind_same_day, before_days, event_types, change_notification_enabled,
        auto_created, enabled, created_at, updated_at, deleted_at
      ) VALUES (
        gen_random_uuid(), ${userId}, ${opportunityId}, ${next.remind7Days}, ${next.remind3Days}, ${next.remind1Day},
        ${next.remindSameDay}, '[7,3,1]'::jsonb, '["DEADLINE"]'::jsonb, ${next.changeNotificationEnabled}, true, ${next.enabled}, now(), now(), NULL
      ) ON CONFLICT (user_id, opportunity_id) DO UPDATE SET
        remind_7_days = EXCLUDED.remind_7_days, remind_3_days = EXCLUDED.remind_3_days,
        remind_1_day = EXCLUDED.remind_1_day, remind_same_day = EXCLUDED.remind_same_day,
        change_notification_enabled = EXCLUDED.change_notification_enabled,
        enabled = EXCLUDED.enabled, deleted_at = NULL, updated_at = now()
    `;
    await sql`UPDATE notification_deliveries SET delivery_status = 'cancelled', updated_at = now() WHERE user_id = ${userId} AND opportunity_id = ${opportunityId} AND delivery_status = 'pending'`;
    await scheduleForFavorite(sql, userId, opportunityId, next);
    return next;
  }

  async function listNotifications({ userEmail, unreadOnly = false }: { userEmail: string; unreadOnly?: boolean }) {
    const userId = await userIdForEmail(sql, userEmail);
    const rows = await sql`
      SELECT id::text AS id, opportunity_id::text AS opportunity_id, type, title, body,
             action_url, read_at, created_at
      FROM notifications
      WHERE user_id = ${userId} ${unreadOnly ? sql`AND read_at IS NULL` : sql``}
      ORDER BY created_at DESC LIMIT 100
    `;
    return rows.map((row) => ({ id: String(row.id), opportunityId: row.opportunity_id ? String(row.opportunity_id) : null, type: String(row.type), title: String(row.title), body: String(row.body), actionUrl: row.action_url ? String(row.action_url) : null, readAt: row.read_at ? new Date(String(row.read_at)).toISOString() : null, createdAt: new Date(String(row.created_at)).toISOString() }));
  }

  async function markNotificationRead({ userEmail, notificationId }: { userEmail: string; notificationId: string }) {
    const userId = await userIdForEmail(sql, userEmail);
    await sql`UPDATE notifications SET read_at = COALESCE(read_at, now()), updated_at = now() WHERE id = ${notificationId} AND user_id = ${userId}`;
  }

  const reminderJobRepository: ReminderJobRepository = {
    async listDueDeliveries(now) {
      await ensureReminderColumns(sql);
      const rows = await sql`
        SELECT d.id::text AS id, d.user_id::text AS user_id, d.opportunity_id::text AS opportunity_id,
               o.title AS opportunity_title, o.deadline_at, d.reminder_type,
               COALESCE(t.status, '准备报名') AS application_status,
               (f.deleted_at IS NULL) AS favorite_active,
               COALESCE(s.enabled, true) AS settings_enabled,
               (o.publication_status = 'published' AND o.calculated_status <> 'closed') AS opportunity_active
        FROM notification_deliveries d
        JOIN opportunities o ON o.id = d.opportunity_id
        JOIN opportunity_favorites f ON f.user_id = d.user_id AND f.opportunity_id = d.opportunity_id
        LEFT JOIN opportunity_reminder_settings s ON s.user_id = d.user_id AND s.opportunity_id = d.opportunity_id
        LEFT JOIN opportunity_application_trackers t ON t.user_id = d.user_id AND t.opportunity_id = d.opportunity_id
        WHERE d.delivery_status = 'pending' AND d.scheduled_at <= ${now}
          AND (d.claimed_at IS NULL OR d.claimed_at < ${new Date(now.getTime() - 15 * 60 * 1000)})
        ORDER BY d.scheduled_at ASC LIMIT 500
      `;
      return rows.map((row) => ({ id: String(row.id), userId: String(row.user_id), opportunityId: String(row.opportunity_id), opportunityTitle: String(row.opportunity_title), deadlineAt: row.deadline_at as string, reminderType: String(row.reminder_type) as DueReminderDelivery["reminderType"], actionUrl: `/opportunities/${row.opportunity_id}`, applicationStatus: row.application_status ? String(row.application_status) : null, favoriteActive: row.favorite_active === true, settingsEnabled: row.settings_enabled !== false, opportunityActive: row.opportunity_active === true }));
    },
    async claimPendingDelivery(deliveryId, now) {
      const rows = await sql`UPDATE notification_deliveries SET claimed_at = ${now}, updated_at = now() WHERE id = ${deliveryId} AND delivery_status = 'pending' AND (claimed_at IS NULL OR claimed_at < ${new Date(now.getTime() - 15 * 60 * 1000)}) RETURNING id`;
      return rows.length > 0;
    },
    async createNotification(notification) {
      await sql`INSERT INTO notifications (id, user_id, opportunity_id, type, title, body, action_url, scheduled_for, sent_at, created_at, updated_at) VALUES (gen_random_uuid(), ${notification.userId}, ${notification.opportunityId}, ${notification.type}, ${notification.title}, ${notification.body}, ${notification.actionUrl}, now(), now(), now(), now())`;
    },
    async markDelivered(deliveryId, deliveredAt) {
      await sql`UPDATE notification_deliveries SET delivery_status = 'delivered', delivered_at = ${deliveredAt}, claimed_at = NULL, updated_at = now() WHERE id = ${deliveryId}`;
    },
    async markSkipped(deliveryId, reason, at) {
      await sql`UPDATE notification_deliveries SET delivery_status = 'skipped', failure_reason = ${reason}, claimed_at = NULL, updated_at = ${at} WHERE id = ${deliveryId}`;
    },
    async markFailed(deliveryId, reason, at) {
      await sql`UPDATE notification_deliveries SET delivery_status = 'failed', failure_reason = ${reason}, claimed_at = NULL, updated_at = ${at} WHERE id = ${deliveryId}`;
    },
  };

  return { favoriteOpportunity, unfavoriteOpportunity, getReminderSettings, updateReminderSettings, listNotifications, markNotificationRead, reminderJobRepository: () => reminderJobRepository };
}

export function getReminderStore(): ReminderStore {
  return makeStore();
}

type DueReminderDelivery = Awaited<ReturnType<ReminderJobRepository["listDueDeliveries"]>>[number];
