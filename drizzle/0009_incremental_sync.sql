-- Incremental public-source monitoring. It never grants access to login,
-- CAPTCHA, robots restrictions, or cross-domain redirects.
ALTER TABLE "data_sources"
  ADD COLUMN IF NOT EXISTS "incremental_sync_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sync_active_months" jsonb NOT NULL DEFAULT '[2,3,4,5,7,8,9,10,11,12]';

ALTER TABLE "admin_tasks"
  ADD COLUMN IF NOT EXISTS "raw_source_item_id" uuid REFERENCES "raw_source_items"("id");

ALTER TABLE "notification_deliveries"
  ADD COLUMN IF NOT EXISTS "claimed_at" timestamptz;

CREATE INDEX IF NOT EXISTS "data_sources_incremental_sync_idx"
  ON "data_sources" ("incremental_sync_enabled", "next_check_at");
CREATE INDEX IF NOT EXISTS "admin_tasks_raw_source_item_idx"
  ON "admin_tasks" ("raw_source_item_id");
