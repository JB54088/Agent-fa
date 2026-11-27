-- Nationwide source directory: organization tree, region binding and discovery review gate.
ALTER TYPE "source_discovery_status" ADD VALUE IF NOT EXISTS 'DISCOVERED';
ALTER TYPE "source_discovery_status" ADD VALUE IF NOT EXISTS 'VERIFIED';

DO $$ BEGIN
  CREATE TYPE "source_category" AS ENUM ('ENTERPRISE', 'CENTRAL_SOE', 'LOCAL_SOE', 'NATIONAL_CIVIL_SERVICE', 'PROVINCIAL_CIVIL_SERVICE', 'GOVERNMENT', 'UNIVERSITY_EMPLOYMENT', 'OTHER_OFFICIAL', 'ENTERPRISE_DISCOVERY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "source_frequency" AS ENUM ('DAILY', 'EVERY_7_DAYS', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "organizations"("id"),
  ADD COLUMN IF NOT EXISTS "region_id" uuid REFERENCES "regions"("id");
CREATE INDEX IF NOT EXISTS "organizations_parent_idx" ON "organizations" ("parent_id");
CREATE INDEX IF NOT EXISTS "organizations_region_idx" ON "organizations" ("region_id");

ALTER TABLE "data_sources"
  ADD COLUMN IF NOT EXISTS "region_id" uuid REFERENCES "regions"("id"),
  ADD COLUMN IF NOT EXISTS "source_category" "source_category",
  ADD COLUMN IF NOT EXISTS "normal_frequency" "source_frequency" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "active_frequency" "source_frequency" NOT NULL DEFAULT 'DAILY',
  ADD COLUMN IF NOT EXISTS "last_changed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "failure_count" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "data_sources_region_idx" ON "data_sources" ("region_id");
CREATE INDEX IF NOT EXISTS "data_sources_category_idx" ON "data_sources" ("source_category");
CREATE INDEX IF NOT EXISTS "data_sources_next_check_idx" ON "data_sources" ("next_check_at");

CREATE TABLE IF NOT EXISTS "source_discoveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "source_url" text,
  "source_domain" text,
  "source_category" "source_category" NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id"),
  "region_id" uuid REFERENCES "regions"("id"),
  "discovery_method" text NOT NULL,
  "discovery_status" "source_discovery_status" NOT NULL DEFAULT 'DISCOVERED',
  "promoted_source_id" uuid REFERENCES "data_sources"("id"),
  "discovered_at" timestamptz NOT NULL DEFAULT now(),
  "reviewed_at" timestamptz,
  "reviewed_by" uuid REFERENCES "users"("id"),
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "source_discoveries_status_idx" ON "source_discoveries" ("discovery_status");
CREATE INDEX IF NOT EXISTS "source_discoveries_category_idx" ON "source_discoveries" ("source_category");
CREATE INDEX IF NOT EXISTS "source_discoveries_region_idx" ON "source_discoveries" ("region_id");
