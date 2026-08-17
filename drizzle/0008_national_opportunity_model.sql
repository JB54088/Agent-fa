-- Unified nationwide opportunity model extensions.
-- Existing records remain valid; all new collection batches continue to use
-- raw_source_items -> staging_opportunities -> opportunities.

ALTER TYPE "opportunity_type" ADD VALUE IF NOT EXISTS 'BANK_CAMPUS';

ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "verified_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "next_verify_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "official_page_status" "official_page_status" NOT NULL DEFAULT 'unknown';

ALTER TABLE "staging_opportunities"
  ADD COLUMN IF NOT EXISTS "opportunity_type" "opportunity_type",
  ADD COLUMN IF NOT EXISTS "recruitment_season" text,
  ADD COLUMN IF NOT EXISTS "recruitment_year" integer,
  ADD COLUMN IF NOT EXISTS "deadline_type" "deadline_type";

ALTER TABLE "opportunity_positions"
  ADD COLUMN IF NOT EXISTS "organization_name" text,
  ADD COLUMN IF NOT EXISTS "department_name" text,
  ADD COLUMN IF NOT EXISTS "recruitment_count" integer,
  ADD COLUMN IF NOT EXISTS "education_requirement" text,
  ADD COLUMN IF NOT EXISTS "degree_requirement" text,
  ADD COLUMN IF NOT EXISTS "major_requirement_raw" text,
  ADD COLUMN IF NOT EXISTS "political_status_requirement" text,
  ADD COLUMN IF NOT EXISTS "fresh_graduate_requirement" text,
  ADD COLUMN IF NOT EXISTS "age_requirement" text,
  ADD COLUMN IF NOT EXISTS "household_requirement" text,
  ADD COLUMN IF NOT EXISTS "work_experience_requirement" text,
  ADD COLUMN IF NOT EXISTS "certificate_requirement" text,
  ADD COLUMN IF NOT EXISTS "region_id" uuid REFERENCES "regions"("id"),
  ADD COLUMN IF NOT EXISTS "remarks" text;

CREATE INDEX IF NOT EXISTS "opportunity_positions_region_idx"
  ON "opportunity_positions" ("region_id");

CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_positions_opportunity_code_uidx"
  ON "opportunity_positions" ("opportunity_id", "position_code")
  WHERE "position_code" IS NOT NULL;

ALTER TABLE "opportunity_major_rules"
  ADD COLUMN IF NOT EXISTS "rule_value" text,
  ADD COLUMN IF NOT EXISTS "major_category_id" uuid REFERENCES "major_categories"("id");

CREATE INDEX IF NOT EXISTS "opportunity_major_rules_opportunity_idx"
  ON "opportunity_major_rules" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "opportunity_major_rules_type_idx"
  ON "opportunity_major_rules" ("rule_type");

DO $$ BEGIN
  ALTER TABLE "regions"
    ADD CONSTRAINT "regions_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "regions"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
