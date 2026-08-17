import { buildDeadlineReminderMessage, type ReminderType } from "./deadline.ts";

export type DueReminderDelivery = {
  id: string;
  userId: string;
  opportunityId: string;
  opportunityTitle: string;
  deadlineAt: string | Date;
  reminderType: ReminderType;
  actionUrl: string;
  applicationStatus?: string | null;
  favoriteActive: boolean;
  settingsEnabled: boolean;
  opportunityActive: boolean;
};

export type ReminderNotification = {
  userId: string;
  opportunityId: string;
  type: "DEADLINE_REMINDER";
  title: string;
  body: string;
  actionUrl: string;
  deliveryId: string;
};

export type ReminderJobRepository = {
  listDueDeliveries: (now: Date) => Promise<DueReminderDelivery[]>;
  claimPendingDelivery: (deliveryId: string, now: Date) => Promise<boolean>;
  createNotification: (notification: ReminderNotification) => Promise<void>;
  markDelivered: (deliveryId: string, deliveredAt: Date) => Promise<void>;
  markSkipped: (deliveryId: string, reason: string, at: Date) => Promise<void>;
  markFailed: (deliveryId: string, reason: string, at: Date) => Promise<void>;
};

export type ReminderJobResult = {
  scanned: number;
  delivered: number;
  skipped: number;
  failed: number;
  alreadyClaimed: number;
};

/**
 * Runs the delivery side of the daily job. The repository must claim a row
 * atomically (pending -> processing/claimed) and persist notification creation
 * plus delivery completion in one transaction in the production adapter.
 */
export async function runDeadlineReminderJob(repository: ReminderJobRepository, now = new Date()): Promise<ReminderJobResult> {
  const dueDeliveries = await repository.listDueDeliveries(now);
  const result: ReminderJobResult = { scanned: dueDeliveries.length, delivered: 0, skipped: 0, failed: 0, alreadyClaimed: 0 };

  for (const delivery of dueDeliveries) {
    if (!delivery.favoriteActive || !delivery.settingsEnabled || !delivery.opportunityActive) {
      await repository.markSkipped(delivery.id, "favorite_or_opportunity_inactive", now);
      result.skipped += 1;
      continue;
    }

    const claimed = await repository.claimPendingDelivery(delivery.id, now);
    if (!claimed) {
      result.alreadyClaimed += 1;
      continue;
    }

    try {
      const message = buildDeadlineReminderMessage({
        title: delivery.opportunityTitle,
        reminderType: delivery.reminderType,
        deadlineAt: delivery.deadlineAt,
        applicationStatus: delivery.applicationStatus,
      });
      await repository.createNotification({
        userId: delivery.userId,
        opportunityId: delivery.opportunityId,
        type: message.category,
        title: message.title,
        body: message.body,
        actionUrl: delivery.actionUrl,
        deliveryId: delivery.id,
      });
      await repository.markDelivered(delivery.id, now);
      result.delivered += 1;
    } catch (error) {
      await repository.markFailed(delivery.id, error instanceof Error ? error.message : "unknown_error", now);
      result.failed += 1;
    }
  }

  return result;
}
