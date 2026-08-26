-- Store corrections against the canonical opportunities model and expose
-- them to the administrator review queue.
CREATE TABLE IF NOT EXISTS "user_correction_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
  "user_id" uuid REFERENCES "users"("id"),
  "reporter_email" text,
  "type" text NOT NULL,
  "content" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamptz,
  "admin_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "user_correction_reports_status_idx"
  ON "user_correction_reports" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "user_correction_reports_opportunity_idx"
  ON "user_correction_reports" ("opportunity_id", "created_at");
