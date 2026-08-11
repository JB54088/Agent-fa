import type { ReminderSettings } from "./deadline";
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

/**
 * The application intentionally fails closed until a real PostgreSQL adapter
 * is configured. No in-memory or browser-only reminder store is used here.
 */
export function getReminderStore(): ReminderStore {
  throw new Error("Reminder persistence is not configured. Set DATABASE_URL and provide the production database adapter.");
}
