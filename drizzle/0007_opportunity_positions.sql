CREATE TABLE IF NOT EXISTS "opportunity_positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
  "position_name" text NOT NULL,
  "position_code" text,
  "department" text,
  "location" text,
  "description" text,
  "requirements" text,
  "source_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "opportunity_positions_opportunity_idx"
  ON "opportunity_positions" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "opportunity_positions_code_idx"
  ON "opportunity_positions" ("position_code");
