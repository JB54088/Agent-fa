-- Formalized, versioned higher-education major directory.
-- The import job must load official source metadata before directory rows.

CREATE TABLE IF NOT EXISTS "major_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "publisher" text NOT NULL,
  "source_url" text NOT NULL,
  "notice_url" text,
  "source_file_name" text,
  "content_hash" text,
  "published_at" date,
  "imported_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "major_sources_hash_uidx" ON "major_sources" ("content_hash") WHERE "content_hash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "major_sources_publisher_idx" ON "major_sources" ("publisher");

CREATE TABLE IF NOT EXISTS "major_directory_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "directory_type" text NOT NULL,
  "version" text NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "major_sources"("id"),
  "effective_from" date,
  "effective_to" date,
  "is_current" boolean NOT NULL DEFAULT false,
  "item_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  UNIQUE ("directory_type", "version")
);
CREATE INDEX IF NOT EXISTS "major_directory_current_idx" ON "major_directory_versions" ("directory_type", "is_current");

CREATE TABLE IF NOT EXISTS "disciplines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "parent_id" uuid,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "education_level" text NOT NULL,
  "directory_version_id" uuid NOT NULL REFERENCES "major_directory_versions"("id"),
  "is_current" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  UNIQUE ("code", "directory_version_id", "education_level")
);
CREATE INDEX IF NOT EXISTS "disciplines_parent_idx" ON "disciplines" ("parent_id");
CREATE INDEX IF NOT EXISTS "disciplines_name_idx" ON "disciplines" ("name");

CREATE TABLE IF NOT EXISTS "professional_degree_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "name" text NOT NULL,
  "discipline_id" uuid REFERENCES "disciplines"("id"),
  "directory_version_id" uuid NOT NULL REFERENCES "major_directory_versions"("id"),
  "master_only" boolean NOT NULL DEFAULT false,
  "is_current" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  UNIQUE ("code", "directory_version_id")
);
CREATE INDEX IF NOT EXISTS "professional_degree_name_idx" ON "professional_degree_categories" ("name");

DROP INDEX IF EXISTS "major_categories_code_uidx";
ALTER TABLE "major_categories" ADD COLUMN IF NOT EXISTS "directory_version_id" uuid REFERENCES "major_directory_versions"("id");
ALTER TABLE "major_categories" ADD COLUMN IF NOT EXISTS "source_id" uuid REFERENCES "major_sources"("id");
ALTER TABLE "major_categories" ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS "major_categories_code_version_uidx" ON "major_categories" ("code", "directory_version_id");
CREATE INDEX IF NOT EXISTS "major_categories_current_idx" ON "major_categories" ("is_current");

ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "discipline_id" uuid REFERENCES "disciplines"("id");
ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "directory_version_id" uuid REFERENCES "major_directory_versions"("id");
ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "source_id" uuid REFERENCES "major_sources"("id");
ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "education_level" text NOT NULL DEFAULT 'undergraduate';
ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "entry_type" text NOT NULL DEFAULT 'major';
ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT true;
ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "effective_from" date;
ALTER TABLE "majors" ADD COLUMN IF NOT EXISTS "deprecated_at" date;
CREATE INDEX IF NOT EXISTS "majors_code_level_version_idx" ON "majors" ("code", "education_level", "directory_version_id");
CREATE INDEX IF NOT EXISTS "majors_current_idx" ON "majors" ("is_current", "education_level");

ALTER TABLE "major_aliases" ADD COLUMN IF NOT EXISTS "source_id" uuid REFERENCES "major_sources"("id");
ALTER TABLE "major_aliases" ADD COLUMN IF NOT EXISTS "confidence" integer;
ALTER TABLE "major_aliases" ADD COLUMN IF NOT EXISTS "is_official" boolean NOT NULL DEFAULT false;

ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "pending_major_text" text;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "major_selection_status" text NOT NULL DEFAULT 'unselected';

ALTER TABLE "recruitment_major_rules" ADD COLUMN IF NOT EXISTS "major_id" uuid REFERENCES "majors"("id");
ALTER TABLE "recruitment_major_rules" ADD COLUMN IF NOT EXISTS "major_category_id" uuid REFERENCES "major_categories"("id");
ALTER TABLE "recruitment_major_rules" ADD COLUMN IF NOT EXISTS "confidence" integer;

CREATE TABLE IF NOT EXISTS "major_successor_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_major_id" uuid NOT NULL REFERENCES "majors"("id"),
  "to_major_id" uuid NOT NULL REFERENCES "majors"("id"),
  "mapping_type" text NOT NULL,
  "source_id" uuid REFERENCES "major_sources"("id"),
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  UNIQUE ("from_major_id", "to_major_id")
);
CREATE INDEX IF NOT EXISTS "major_successor_from_idx" ON "major_successor_mappings" ("from_major_id");
CREATE INDEX IF NOT EXISTS "major_successor_to_idx" ON "major_successor_mappings" ("to_major_id");

CREATE TABLE IF NOT EXISTS "major_import_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id" uuid NOT NULL REFERENCES "major_sources"("id"),
  "directory_version_id" uuid NOT NULL REFERENCES "major_directory_versions"("id"),
  "input_file_name" text NOT NULL,
  "input_hash" text NOT NULL,
  "row_count" integer NOT NULL DEFAULT 0,
  "accepted_count" integer NOT NULL DEFAULT 0,
  "rejected_count" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "error_summary" text,
  "imported_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "major_import_runs_version_idx" ON "major_import_runs" ("directory_version_id", "created_at");
CREATE INDEX IF NOT EXISTS "major_import_runs_hash_idx" ON "major_import_runs" ("input_hash");

CREATE TABLE IF NOT EXISTS "opportunity_major_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
  "rule_type" text NOT NULL,
  "major_id" uuid REFERENCES "majors"("id"),
  "discipline_id" uuid REFERENCES "disciplines"("id"),
  "professional_degree_category_id" uuid REFERENCES "professional_degree_categories"("id"),
  "original_text" text NOT NULL,
  "confidence" integer,
  "requires_manual_review" boolean NOT NULL DEFAULT true,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "opportunity_major_rules_opportunity_idx" ON "opportunity_major_rules" ("opportunity_id");
CREATE INDEX IF NOT EXISTS "opportunity_major_rules_major_idx" ON "opportunity_major_rules" ("major_id");
CREATE INDEX IF NOT EXISTS "opportunity_major_rules_discipline_idx" ON "opportunity_major_rules" ("discipline_id");
