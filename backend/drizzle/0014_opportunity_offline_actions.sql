-- Formal recruitment moderation: reversible offline status plus an audit trail.
-- Existing published opportunities are not changed by this migration.

ALTER TYPE "publish_status" ADD VALUE IF NOT EXISTS 'offline';

ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "offline_reason" text,
  ADD COLUMN IF NOT EXISTS "offline_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "offline_by" uuid REFERENCES "users"("id");

CREATE INDEX IF NOT EXISTS "opportunities_publication_status_idx"
  ON "opportunities" ("publication_status");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "action" text NOT NULL,
  "opportunity_id" uuid,
  "operator" text NOT NULL,
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_logs_opportunity_idx"
  ON "audit_logs" ("opportunity_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"
  ON "audit_logs" ("action", "created_at");
