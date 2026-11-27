-- Deadline reminders: persisted settings, idempotent deliveries and in-app message links.
ALTER TYPE "delivery_status" ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "deadline_at" timestamptz;

ALTER TABLE "opportunity_reminder_settings"
  ADD COLUMN IF NOT EXISTS "remind_7_days" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remind_3_days" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remind_1_day" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remind_same_day" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "change_notification_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "auto_created" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true;

ALTER TABLE "reminder_settings"
  ADD COLUMN IF NOT EXISTS "remind_7_days" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remind_3_days" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remind_1_day" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remind_same_day" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "auto_created" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true;

ALTER TABLE "notification_deliveries"
  ADD COLUMN IF NOT EXISTS "opportunity_id" uuid REFERENCES "opportunities"("id"),
  ADD COLUMN IF NOT EXISTS "opportunity_event_id" uuid REFERENCES "opportunity_events"("id");

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "opportunity_id" uuid REFERENCES "opportunities"("id"),
  ADD COLUMN IF NOT EXISTS "action_url" text;

CREATE INDEX IF NOT EXISTS "notification_deliveries_opportunity_idx"
  ON "notification_deliveries" ("opportunity_id", "delivery_status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "notifications_opportunity_idx"
  ON "notifications" ("opportunity_id", "created_at");
CREATE INDEX IF NOT EXISTS "opportunities_deadline_idx"
  ON "opportunities" ("deadline_type", "deadline_at", "publication_status");
