-- Stage one: source audit, safe fetching and collection review queue.
CREATE TYPE "source_discovery_status" AS ENUM ('AUTO_ALLOWED', 'ATTACHMENT_ONLY', 'MANUAL_ONLY', 'NEEDS_REVIEW', 'BLOCKED', 'INACTIVE', 'UNKNOWN');
CREATE TYPE "source_run_status" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'SKIPPED', 'BLOCKED');
CREATE TYPE "collection_review_status" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'DUPLICATE', 'NEEDS_MORE_INFORMATION');
CREATE TYPE "collection_review_task_type" AS ENUM ('NEW_ITEM', 'CHANGED_ITEM', 'POSSIBLE_DUPLICATE', 'PARSE_FAILURE', 'SOURCE_AUDIT', 'SOURCE_HEALTH');

ALTER TABLE "organizations"
  ADD COLUMN "industry" text,
  ADD COLUMN "recruitment_website" text,
  ADD COLUMN "logo_url" text,
  ADD COLUMN "priority" text NOT NULL DEFAULT 'P2';
CREATE INDEX "organizations_priority_idx" ON "organizations" ("priority");

ALTER TABLE "data_sources"
  ADD COLUMN "organization_id" uuid REFERENCES "organizations"("id"),
  ADD COLUMN "source_domain" text,
  ADD COLUMN "crawler_strategy" text,
  ADD COLUMN "list_page_url" text,
  ADD COLUMN "detail_url_pattern" text,
  ADD COLUMN "api_url" text,
  ADD COLUMN "rss_url" text,
  ADD COLUMN "robots_url" text,
  ADD COLUMN "robots_checked_at" timestamptz,
  ADD COLUMN "robots_result" text,
  ADD COLUMN "terms_url" text,
  ADD COLUMN "terms_checked_at" timestamptz,
  ADD COLUMN "terms_result" text,
  ADD COLUMN "requires_javascript" boolean NOT NULL DEFAULT false,
  ADD COLUMN "requires_login" boolean NOT NULL DEFAULT false,
  ADD COLUMN "has_captcha" boolean NOT NULL DEFAULT false,
  ADD COLUMN "allowed_paths" jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN "prohibited_paths" jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN "request_interval_seconds" integer NOT NULL DEFAULT 10,
  ADD COLUMN "max_requests_per_run" integer NOT NULL DEFAULT 20,
  ADD COLUMN "max_requests_per_day" integer NOT NULL DEFAULT 100,
  ADD COLUMN "user_agent" text,
  ADD COLUMN "contact_email" text,
  ADD COLUMN "last_failed_fetch_at" timestamptz,
  ADD COLUMN "consecutive_failure_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "legal_notes" text,
  ADD COLUMN "technical_notes" text,
  ADD COLUMN "discovery_status" "source_discovery_status" NOT NULL DEFAULT 'NEEDS_REVIEW',
  ADD COLUMN "automation_allowed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "source_last_verified_at" timestamptz;
CREATE INDEX "data_sources_organization_idx" ON "data_sources" ("organization_id");
CREATE INDEX "data_sources_discovery_status_idx" ON "data_sources" ("discovery_status");

ALTER TABLE "opportunities"
  ADD COLUMN "work_locations" jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN "recruitment_number" integer,
  ADD COLUMN "data_credibility" text NOT NULL DEFAULT '待评估';

ALTER TABLE "opportunity_events"
  ADD COLUMN "original_text" text;

CREATE TABLE "source_fetch_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "data_source_id" uuid NOT NULL REFERENCES "data_sources"("id"),
  "started_at" timestamptz NOT NULL DEFAULT now(), "finished_at" timestamptz,
  "run_status" "source_run_status" NOT NULL DEFAULT 'RUNNING',
  "request_count" integer NOT NULL DEFAULT 0, "discovered_count" integer NOT NULL DEFAULT 0,
  "created_count" integer NOT NULL DEFAULT 0, "updated_count" integer NOT NULL DEFAULT 0,
  "skipped_count" integer NOT NULL DEFAULT 0, "duplicate_count" integer NOT NULL DEFAULT 0,
  "error_count" integer NOT NULL DEFAULT 0, "http_status_summary" jsonb,
  "error_message" text, "log_path" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "source_fetch_runs_source_idx" ON "source_fetch_runs" ("data_source_id", "started_at");
CREATE INDEX "source_fetch_runs_status_idx" ON "source_fetch_runs" ("run_status");

CREATE TABLE "collection_review_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "raw_item_id" uuid NOT NULL REFERENCES "raw_collected_items"("id"),
  "opportunity_id" uuid REFERENCES "opportunities"("id"),
  "task_type" "collection_review_task_type" NOT NULL,
  "review_status" "collection_review_status" NOT NULL DEFAULT 'PENDING',
  "assigned_admin_id" uuid REFERENCES "users"("id"),
  "automated_confidence" integer, "review_notes" text, "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "collection_review_tasks_status_idx" ON "collection_review_tasks" ("review_status");
CREATE INDEX "collection_review_tasks_assignee_idx" ON "collection_review_tasks" ("assigned_admin_id", "review_status");
CREATE INDEX "collection_review_tasks_raw_idx" ON "collection_review_tasks" ("raw_item_id");
