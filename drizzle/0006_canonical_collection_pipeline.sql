-- Canonical collection pipeline. New records use raw_source_items ->
-- staging_opportunities -> opportunities. The legacy raw_collected_items table
-- is retained during migration so historical records are not discarded.

DO $$ BEGIN
  CREATE TYPE "staging_review_status" AS ENUM ('PENDING', 'IN_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'REJECTED', 'DUPLICATE', 'NEEDS_MORE_INFORMATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "opportunity_relevance_status" AS ENUM ('CURRENT_OPEN', 'UPCOMING', 'RECENT_CLOSED', 'HISTORICAL', 'PUBLIC_NOTICE', 'RESULT_NOTICE', 'NOT_AN_OPPORTUNITY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "opportunity_relevance_status" "opportunity_relevance_status" NOT NULL DEFAULT 'CURRENT_OPEN',
  ADD COLUMN IF NOT EXISTS "d_special_approval" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "d_special_approval_reason" text,
  ADD COLUMN IF NOT EXISTS "d_special_approved_by" uuid REFERENCES "users"("id");

ALTER TABLE "recruitment_projects"
  ADD COLUMN IF NOT EXISTS "opportunity_relevance_status" "opportunity_relevance_status" NOT NULL DEFAULT 'CURRENT_OPEN';

CREATE TABLE IF NOT EXISTS "raw_source_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "data_source_id" uuid NOT NULL REFERENCES "data_sources"("id"),
  "collection_run_id" uuid REFERENCES "collection_runs"("id"),
  "source_url" text NOT NULL,
  "original_title" text,
  "original_content" text,
  "original_html" text,
  "attachment_urls" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "published_at" timestamptz,
  "collected_at" timestamptz NOT NULL DEFAULT now(),
  "content_hash" text NOT NULL,
  "previous_content_hash" text,
  "content_summary" text,
  "previous_content_summary" text,
  "parser_name" text,
  "parser_result" jsonb,
  "normalized_payload" jsonb,
  "parse_status" "parse_status" NOT NULL DEFAULT 'pending',
  "review_status" "raw_review_status" NOT NULL DEFAULT 'pending',
  "duplicate_status" "duplicate_status" NOT NULL DEFAULT 'pending',
  "promoted_opportunity_id" uuid REFERENCES "opportunities"("id"),
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamptz,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "raw_source_items_source_collected_idx" ON "raw_source_items" ("data_source_id", "collected_at");
CREATE INDEX IF NOT EXISTS "raw_source_items_review_idx" ON "raw_source_items" ("review_status");
CREATE INDEX IF NOT EXISTS "raw_source_items_hash_idx" ON "raw_source_items" ("content_hash");

CREATE TABLE IF NOT EXISTS "staging_opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "raw_source_item_id" uuid REFERENCES "raw_source_items"("id"),
  "data_source_id" uuid REFERENCES "data_sources"("id"),
  "import_batch_id" uuid REFERENCES "import_batches"("id"),
  "organization_id" uuid REFERENCES "organizations"("id"),
  "company_name" text NOT NULL,
  "project_name" text NOT NULL,
  "recruitment_batch" text,
  "graduation_years" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "degree_requirements" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "original_major_text" text NOT NULL,
  "normalized_major_names" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "major_categories" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "work_locations" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "published_at" date,
  "start_at" date,
  "deadline" date,
  "announcement_url" text,
  "application_url" text,
  "relevance_status" "opportunity_relevance_status" NOT NULL DEFAULT 'CURRENT_OPEN',
  "validation_errors" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "dedupe_key" text,
  "review_status" "staging_review_status" NOT NULL DEFAULT 'PENDING',
  "reviewer_note" text,
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamptz,
  "promoted_opportunity_id" uuid REFERENCES "opportunities"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "staging_opportunities_review_idx" ON "staging_opportunities" ("review_status", "created_at");
CREATE INDEX IF NOT EXISTS "staging_opportunities_dedupe_idx" ON "staging_opportunities" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "staging_opportunities_raw_idx" ON "staging_opportunities" ("raw_source_item_id");

-- Copy legacy raw records once. The source table remains intact until an
-- operator verifies the counts and removes it in a separate change.
INSERT INTO "raw_source_items" (
  "id", "data_source_id", "collection_run_id", "source_url", "original_title",
  "original_content", "original_html", "attachment_urls", "published_at",
  "collected_at", "content_hash", "previous_content_hash", "content_summary",
  "previous_content_summary", "parser_name", "parser_result", "normalized_payload",
  "parse_status", "review_status", "duplicate_status", "promoted_opportunity_id",
  "reviewed_by", "reviewed_at", "error_message", "created_at", "updated_at", "deleted_at"
)
SELECT "id", "data_source_id", "collection_run_id", "source_url", "original_title",
  "original_content", "original_html", "attachment_urls", "published_at",
  "collected_at", "content_hash", "previous_content_hash", "content_summary",
  "previous_content_summary", "parser_name",
  COALESCE("parser_result", '{}'::jsonb) || jsonb_build_object('legacy_promoted_project_id', "promoted_project_id"),
  "normalized_payload",
  "parse_status", "review_status", "duplicate_status", NULL,
  "reviewed_by", "reviewed_at", "error_message", "created_at", "updated_at", "deleted_at"
FROM "raw_collected_items"
ON CONFLICT ("id") DO NOTHING;
