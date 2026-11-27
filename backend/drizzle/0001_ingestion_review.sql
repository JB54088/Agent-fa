CREATE TYPE "source_type" AS ENUM ('企业官网', '招聘官网', '政府官网', '官方公众号', '高校就业网', '第三方网站');
CREATE TYPE "collection_method" AS ENUM ('人工录入', 'HTML页面', '公开API', 'PDF附件', 'Excel附件');
CREATE TYPE "source_status" AS ENUM ('active', 'paused', 'invalid');
CREATE TYPE "parse_status" AS ENUM ('pending', 'success', 'partial', 'failed');
CREATE TYPE "raw_review_status" AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'snoozed', 'converted');
CREATE TYPE "duplicate_status" AS ENUM ('pending', 'unique', 'suspected', 'confirmed', 'not_duplicate');
CREATE TYPE "publish_status" AS ENUM ('draft', 'pending_review', 'approved', 'published', 'rejected', 'withdrawn');
CREATE TYPE "verification_status" AS ENUM ('unverified', 'pending', 'verified', 'needs_review', 'expired');
CREATE TYPE "official_page_status" AS ENUM ('unknown', 'accessible', 'unreachable', 'redirected', 'blocked', 'expired');
CREATE TYPE "admin_task_status" AS ENUM ('open', 'claimed', 'in_progress', 'completed', 'rejected', 'snoozed');
CREATE TYPE "admin_task_type" AS ENUM ('new_recruitment', 'page_changed', 'official_link_invalid', 'deadline_soon', 'verification_overdue', 'user_correction', 'suspected_duplicate', 'parse_failed');
CREATE TYPE "event_time_status" AS ENUM ('待公布', '预计时间', '已确认', '已变更', '已结束');
CREATE TYPE "personal_task_status" AS ENUM ('待处理', '进行中', '已完成', '已取消');
CREATE TYPE "delivery_status" AS ENUM ('pending', 'delivered', 'failed', 'skipped');

ALTER TABLE "data_sources"
  ADD COLUMN "company_id" uuid REFERENCES "companies"("id"),
  ADD COLUMN "source_type" "source_type",
  ADD COLUMN "collection_method" "collection_method",
  ADD COLUMN "check_frequency" text NOT NULL DEFAULT 'manual',
  ADD COLUMN "last_successful_collected_at" timestamptz,
  ADD COLUMN "content_fingerprint" text,
  ADD COLUMN "requires_manual_review" boolean NOT NULL DEFAULT true,
  ADD COLUMN "status" "source_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "next_check_at" timestamptz,
  ADD COLUMN "last_error" text,
  ADD COLUMN "admin_note" text;
CREATE INDEX "data_sources_company_idx" ON "data_sources" ("company_id");
CREATE INDEX "data_sources_status_idx" ON "data_sources" ("status");

ALTER TABLE "recruitment_projects"
  ADD COLUMN "calculated_status" "project_status" NOT NULL DEFAULT 'pending_review',
  ADD COLUMN "manual_status" "project_status",
  ADD COLUMN "status_override" boolean NOT NULL DEFAULT false,
  ADD COLUMN "status_reason" text,
  ADD COLUMN "publish_status" "publish_status" NOT NULL DEFAULT 'pending_review',
  ADD COLUMN "verified_by" uuid REFERENCES "users"("id"),
  ADD COLUMN "verification_status" "verification_status" NOT NULL DEFAULT 'unverified',
  ADD COLUMN "next_verify_at" timestamptz,
  ADD COLUMN "official_page_status" "official_page_status" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "dedupe_key" text,
  ADD COLUMN "d_special_approval" boolean NOT NULL DEFAULT false,
  ADD COLUMN "d_special_approval_reason" text,
  ADD COLUMN "d_special_approved_by" uuid REFERENCES "users"("id");
CREATE INDEX "projects_dedupe_key_idx" ON "recruitment_projects" ("dedupe_key");

CREATE TABLE "collection_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "data_source_id" uuid NOT NULL REFERENCES "data_sources"("id"),
  "trigger_type" text NOT NULL DEFAULT 'scheduled', "started_at" timestamptz NOT NULL DEFAULT now(), "finished_at" timestamptz,
  "status" text NOT NULL DEFAULT 'running', "fetched_count" integer NOT NULL DEFAULT 0, "created_count" integer NOT NULL DEFAULT 0,
  "changed_count" integer NOT NULL DEFAULT 0, "error_count" integer NOT NULL DEFAULT 0, "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "collection_runs_source_idx" ON "collection_runs" ("data_source_id", "started_at");

CREATE TABLE "raw_collected_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "data_source_id" uuid NOT NULL REFERENCES "data_sources"("id"),
  "collection_run_id" uuid REFERENCES "collection_runs"("id"), "source_url" text NOT NULL, "original_title" text,
  "original_content" text, "original_html" text, "attachment_urls" jsonb NOT NULL DEFAULT '[]',
  "published_at" timestamptz, "collected_at" timestamptz NOT NULL DEFAULT now(), "content_hash" text NOT NULL,
  "previous_content_hash" text, "content_summary" text, "previous_content_summary" text, "parser_name" text,
  "parser_result" jsonb, "normalized_payload" jsonb, "parse_status" "parse_status" NOT NULL DEFAULT 'pending',
  "review_status" "raw_review_status" NOT NULL DEFAULT 'pending', "duplicate_status" "duplicate_status" NOT NULL DEFAULT 'pending',
  "promoted_project_id" uuid REFERENCES "recruitment_projects"("id"), "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamptz, "error_message" text, "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "raw_items_source_collected_idx" ON "raw_collected_items" ("data_source_id", "collected_at");
CREATE INDEX "raw_items_review_idx" ON "raw_collected_items" ("review_status");
CREATE INDEX "raw_items_hash_idx" ON "raw_collected_items" ("content_hash");

CREATE TABLE "source_change_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "data_source_id" uuid NOT NULL REFERENCES "data_sources"("id"),
  "raw_item_id" uuid NOT NULL REFERENCES "raw_collected_items"("id"), "previous_hash" text, "current_hash" text NOT NULL,
  "previous_summary" text, "current_summary" text, "detected_at" timestamptz NOT NULL DEFAULT now(), "review_task_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);

CREATE TABLE "import_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "file_name" text NOT NULL, "file_storage_key" text,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id"), "status" text NOT NULL DEFAULT 'uploaded', "field_mapping" jsonb,
  "total_rows" integer NOT NULL DEFAULT 0, "valid_rows" integer NOT NULL DEFAULT 0, "error_rows" integer NOT NULL DEFAULT 0,
  "duplicate_rows" integer NOT NULL DEFAULT 0, "completed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "import_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "batch_id" uuid NOT NULL REFERENCES "import_batches"("id"),
  "row_number" integer NOT NULL, "raw_data" jsonb NOT NULL, "normalized_data" jsonb, "validation_errors" jsonb NOT NULL DEFAULT '[]',
  "company_match_status" text NOT NULL DEFAULT 'pending', "major_match_status" text NOT NULL DEFAULT 'pending',
  "duplicate_status" "duplicate_status" NOT NULL DEFAULT 'pending', "review_status" "raw_review_status" NOT NULL DEFAULT 'pending',
  "promoted_project_id" uuid REFERENCES "recruitment_projects"("id"), "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz, UNIQUE ("batch_id", "row_number")
);

CREATE TABLE "admin_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "task_type" "admin_task_type" NOT NULL,
  "status" "admin_task_status" NOT NULL DEFAULT 'open', "priority" text NOT NULL DEFAULT 'medium',
  "raw_item_id" uuid REFERENCES "raw_collected_items"("id"), "project_id" uuid REFERENCES "recruitment_projects"("id"),
  "import_row_id" uuid REFERENCES "import_rows"("id"), "correction_report_id" uuid REFERENCES "correction_reports"("id"),
  "assignee_id" uuid REFERENCES "users"("id"), "claimed_at" timestamptz, "due_at" timestamptz,
  "resolution" text, "admin_note" text, "completed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "admin_tasks_status_idx" ON "admin_tasks" ("status", "priority");
CREATE INDEX "admin_tasks_due_idx" ON "admin_tasks" ("due_at");

CREATE TABLE "project_verification_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"),
  "data_source_id" uuid REFERENCES "data_sources"("id"), "verified_by" uuid REFERENCES "users"("id"),
  "verification_status" "verification_status" NOT NULL, "official_page_status" "official_page_status" NOT NULL,
  "observed_content_hash" text, "verification_note" text, "verified_at" timestamptz NOT NULL DEFAULT now(),
  "next_verify_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "verification_records_project_idx" ON "project_verification_records" ("project_id", "verified_at");

ALTER TABLE "recruitment_changes"
  ADD COLUMN "field_name" text,
  ADD COLUMN "old_value" text,
  ADD COLUMN "new_value" text,
  ADD COLUMN "change_description" text,
  ADD COLUMN "changed_at" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN "notify_users" boolean NOT NULL DEFAULT false;

CREATE TABLE "major_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "major_id" uuid NOT NULL REFERENCES "majors"("id"), "alias_name" text NOT NULL,
  "alias_type" text NOT NULL, "source" text, "status" text NOT NULL DEFAULT 'active', "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz, UNIQUE ("major_id", "alias_name")
);
CREATE INDEX "major_aliases_name_idx" ON "major_aliases" ("alias_name");
CREATE TABLE "major_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "major_id" uuid NOT NULL REFERENCES "majors"("id"),
  "major_category_id" uuid NOT NULL REFERENCES "major_categories"("id"), "discipline_id" text, "education_level" text,
  "version" text NOT NULL, "source" text, "status" text NOT NULL DEFAULT 'active', "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "major_mappings_version_idx" ON "major_mappings" ("version");
CREATE TABLE "recruitment_major_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "recruitment_project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"),
  "rule_type" text NOT NULL, "rule_value" text NOT NULL, "original_text" text NOT NULL, "confidence_level" text NOT NULL DEFAULT 'manual',
  "requires_manual_review" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "recruitment_major_rules_project_idx" ON "recruitment_major_rules" ("recruitment_project_id");

CREATE TABLE "recruitment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "recruitment_project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"),
  "event_type" text NOT NULL, "event_name" text NOT NULL, "start_time" timestamptz, "end_time" timestamptz,
  "time_status" "event_time_status" NOT NULL DEFAULT '待公布', "description" text, "is_confirmed" boolean NOT NULL DEFAULT false,
  "source_url" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "recruitment_events_project_idx" ON "recruitment_events" ("recruitment_project_id", "start_time");

CREATE TABLE "personal_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "recruitment_projects"("id"), "title" text NOT NULL, "status" "personal_task_status" NOT NULL DEFAULT '待处理',
  "due_at" timestamptz, "next_action" text, "suggested" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "personal_tasks_user_status_idx" ON "personal_tasks" ("user_id", "status");

CREATE TABLE "notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "recruitment_project_id" uuid REFERENCES "recruitment_projects"("id"), "recruitment_event_id" uuid REFERENCES "recruitment_events"("id"),
  "reminder_type" text NOT NULL, "channel" text NOT NULL DEFAULT 'in_app', "scheduled_at" timestamptz, "delivered_at" timestamptz,
  "delivery_status" "delivery_status" NOT NULL DEFAULT 'pending', "deduplication_key" text NOT NULL UNIQUE, "failure_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "notification_deliveries_user_idx" ON "notification_deliveries" ("user_id", "scheduled_at");

CREATE TABLE "recruitment_project_sources" (
  "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"), "data_source_id" uuid NOT NULL REFERENCES "data_sources"("id"),
  "source_url" text NOT NULL, "source_role" text NOT NULL DEFAULT 'other', "is_primary" boolean NOT NULL DEFAULT false,
  "verified_at" timestamptz, PRIMARY KEY ("project_id", "data_source_id", "source_url")
);
CREATE TABLE "project_target_years" (
  "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"), "graduation_year" integer NOT NULL,
  "dedupe_key" text NOT NULL UNIQUE, PRIMARY KEY ("project_id", "graduation_year")
);
CREATE INDEX "project_target_year_idx" ON "project_target_years" ("graduation_year");

CREATE TABLE "admin_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "actor_id" uuid NOT NULL REFERENCES "users"("id"), "action" text NOT NULL,
  "entity_type" text NOT NULL, "entity_id" uuid, "before_data" jsonb, "after_data" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "admin_audit_actor_idx" ON "admin_audit_logs" ("actor_id", "created_at");

-- Unified opportunity model for enterprise recruitment and future exam/recruitment modules.
CREATE TYPE "opportunity_type" AS ENUM ('ENTERPRISE_CAMPUS', 'CENTRAL_SOE', 'LOCAL_SOE', 'NATIONAL_CIVIL_SERVICE', 'PROVINCIAL_CIVIL_SERVICE', 'SELECTED_GRADUATE', 'PUBLIC_INSTITUTION', 'MILITARY_CIVILIAN', 'OTHER');
CREATE TYPE "deadline_type" AS ENUM ('FIXED_DATE', 'UNTIL_FILLED', 'NOT_ANNOUNCED', 'LONG_TERM', 'ESTIMATED', 'OTHER');
CREATE TYPE "opportunity_event_time_status" AS ENUM ('CONFIRMED', 'ESTIMATED', 'NOT_ANNOUNCED', 'CHANGED', 'ENDED');
CREATE TYPE "opportunity_requirement_type" AS ENUM ('EDUCATION', 'DEGREE', 'MAJOR', 'MAJOR_CATEGORY', 'DISCIPLINE', 'GRADUATION_YEAR', 'FRESH_GRADUATE_STATUS', 'AGE', 'HOUSEHOLD_REGISTRATION', 'POLITICAL_STATUS', 'WORK_EXPERIENCE', 'BASIC_LEVEL_EXPERIENCE', 'CERTIFICATE', 'LANGUAGE_LEVEL', 'GENDER', 'PHYSICAL_CONDITION', 'WORK_REGION', 'OTHER');
CREATE TYPE "admin_role" AS ENUM ('SUPER_ADMIN', 'CONTENT_ADMIN', 'DATA_ENTRY', 'REVIEWER', 'READ_ONLY');

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" text NOT NULL UNIQUE, "short_name" text,
  "organization_type" text NOT NULL, "level" text, "official_website" text, "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "organizations_type_idx" ON "organizations" ("organization_type");

CREATE TABLE "opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "title" text NOT NULL, "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "opportunity_type" "opportunity_type" NOT NULL, "recruitment_season" text, "recruitment_year" integer,
  "target_graduation_years" jsonb NOT NULL DEFAULT '[]', "batch_name" text, "description" text,
  "education_requirements" jsonb NOT NULL DEFAULT '[]', "degree_requirements" jsonb NOT NULL DEFAULT '[]', "major_requirement_text" text,
  "unlimited_major" boolean NOT NULL DEFAULT false, "accepts_related_majors" boolean NOT NULL DEFAULT false,
  "official_announcement_url" text, "official_application_url" text, "source_id" uuid REFERENCES "data_sources"("id"),
  "source_level" "source_level", "verification_status" "verification_status" NOT NULL DEFAULT 'unverified',
  "last_verified_at" timestamptz, "publication_status" "publish_status" NOT NULL DEFAULT 'draft',
  "calculated_status" "project_status" NOT NULL DEFAULT 'pending_review', "manual_status" "project_status",
  "status_override" boolean NOT NULL DEFAULT false, "deadline_type" "deadline_type" NOT NULL DEFAULT 'NOT_ANNOUNCED',
  "is_demo" boolean NOT NULL DEFAULT false, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "opportunities_type_status_idx" ON "opportunities" ("opportunity_type", "calculated_status");
CREATE INDEX "opportunities_org_idx" ON "opportunities" ("organization_id");
CREATE INDEX "opportunities_year_idx" ON "opportunities" ("recruitment_year");

CREATE TABLE "opportunity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
  "event_type" text NOT NULL, "event_name" text NOT NULL, "start_time" timestamptz, "end_time" timestamptz,
  "time_status" "opportunity_event_time_status" NOT NULL DEFAULT 'NOT_ANNOUNCED', "description" text,
  "is_confirmed" boolean NOT NULL DEFAULT false, "source_url" text, "last_verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "opportunity_events_opportunity_idx" ON "opportunity_events" ("opportunity_id", "start_time");
CREATE INDEX "opportunity_events_type_idx" ON "opportunity_events" ("event_type");

CREATE TABLE "opportunity_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
  "requirement_type" "opportunity_requirement_type" NOT NULL, "operator" text NOT NULL, "requirement_value" text NOT NULL,
  "original_text" text NOT NULL, "is_mandatory" boolean NOT NULL DEFAULT true, "requires_manual_review" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "opportunity_requirements_opportunity_idx" ON "opportunity_requirements" ("opportunity_id");
CREATE INDEX "opportunity_requirements_type_idx" ON "opportunity_requirements" ("requirement_type");

CREATE TABLE "opportunity_majors" (
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"), "major_id" uuid NOT NULL REFERENCES "majors"("id"),
  "match_rule" text NOT NULL DEFAULT 'exact', "requires_manual_review" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("opportunity_id", "major_id")
);
CREATE INDEX "opportunity_majors_major_idx" ON "opportunity_majors" ("major_id");
CREATE TABLE "opportunity_regions" (
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"), "region_id" uuid NOT NULL REFERENCES "regions"("id"),
  PRIMARY KEY ("opportunity_id", "region_id")
);
CREATE INDEX "opportunity_regions_region_idx" ON "opportunity_regions" ("region_id");

CREATE TABLE "opportunity_favorites" (
  "user_id" uuid NOT NULL REFERENCES "users"("id"), "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  PRIMARY KEY ("user_id", "opportunity_id")
);
CREATE TABLE "opportunity_application_trackers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"), "status" text NOT NULL DEFAULT '准备报名', "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  UNIQUE ("user_id", "opportunity_id")
);
CREATE TABLE "opportunity_reminder_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id"), "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"),
  "before_days" jsonb NOT NULL DEFAULT '[7,3,1]', "event_types" jsonb NOT NULL DEFAULT '[]', "on_change" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  UNIQUE ("user_id", "opportunity_id")
);

CREATE TABLE "opportunity_changes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id"), "field_name" text NOT NULL,
  "old_value" text, "new_value" text, "change_type" text NOT NULL, "change_description" text, "notify_users" boolean NOT NULL DEFAULT false,
  "changed_at" timestamptz NOT NULL DEFAULT now(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "opportunity_changes_opportunity_idx" ON "opportunity_changes" ("opportunity_id", "changed_at");

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" "admin_role" NOT NULL UNIQUE, "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "code" text NOT NULL UNIQUE, "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "admin_user_roles" (
  "user_id" uuid NOT NULL REFERENCES "users"("id"), "role_id" uuid NOT NULL REFERENCES "roles"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  PRIMARY KEY ("user_id", "role_id")
);
CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles"("id"), "permission_id" uuid NOT NULL REFERENCES "permissions"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  PRIMARY KEY ("role_id", "permission_id")
);
