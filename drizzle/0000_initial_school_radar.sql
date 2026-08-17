CREATE TYPE "company_type" AS ENUM ('央企', '地方国企', '互联网公司', '科技企业', '制造业企业', '金融企业', '知名企业');
CREATE TYPE "source_level" AS ENUM ('A级', 'B级', 'C级', 'D级');
CREATE TYPE "project_status" AS ENUM ('upcoming', 'recruiting', 'ending', 'closed', 'pending_review');
CREATE TYPE "match_level" AS ENUM ('明确匹配', '专业大类匹配', '不限专业', '可能匹配', '暂无匹配依据');
CREATE TYPE "application_status" AS ENUM ('暂未处理', '准备报名', '已报名', '已完成测评', '已参加笔试', '已进入面试', '已结束');
CREATE TYPE "correction_type" AS ENUM ('时间错误', '官方链接失效', '招聘已截止', '专业要求错误', '招聘信息重复', '其他问题');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "phone" text UNIQUE,
  "password_hash" text,
  "email_verified_at" timestamptz,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE TABLE "major_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" text NOT NULL, "code" text NOT NULL UNIQUE,
  "sort_order" integer NOT NULL DEFAULT 0, "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "majors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "category_id" uuid NOT NULL REFERENCES "major_categories"("id"),
  "name" text NOT NULL, "code" text, "aliases" jsonb NOT NULL DEFAULT '[]', "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  UNIQUE ("category_id", "name")
);
CREATE TABLE "regions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "parent_id" uuid, "name" text NOT NULL, "code" text NOT NULL UNIQUE,
  "sort_order" integer NOT NULL DEFAULT 0, "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" text NOT NULL, "short_name" text, "logo" text,
  "company_type" "company_type" NOT NULL, "industry" text, "official_website" text, "recruitment_website" text,
  "description" text, "status" text NOT NULL DEFAULT 'active', "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "data_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" text NOT NULL, "level" "source_level" NOT NULL,
  "source_url" text, "publisher" text, "last_checked_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "recruitment_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "source_id" uuid NOT NULL REFERENCES "data_sources"("id"), "project_name" text NOT NULL, "category" text NOT NULL,
  "company_nature" text, "batch" text, "intro" text, "graduation_years" jsonb NOT NULL DEFAULT '[]',
  "degree_requirements" jsonb NOT NULL DEFAULT '[]', "original_major_text" text NOT NULL,
  "major_categories" jsonb NOT NULL DEFAULT '[]', "no_major_limit" boolean NOT NULL DEFAULT false,
  "accepts_related_major" boolean NOT NULL DEFAULT false, "published_at" date, "start_at" date, "deadline" date,
  "announcement_url" text NOT NULL, "application_url" text NOT NULL,
  "status" "project_status" NOT NULL DEFAULT 'pending_review', "is_recommended" boolean NOT NULL DEFAULT false,
  "is_pinned" boolean NOT NULL DEFAULT false, "admin_note" text, "last_verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  UNIQUE ("company_id", "project_name", "deadline", "batch")
);
CREATE INDEX "projects_status_deadline_idx" ON "recruitment_projects" ("status", "deadline");
CREATE INDEX "projects_published_idx" ON "recruitment_projects" ("published_at");
CREATE TABLE "user_profiles" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id"), "graduation_year" integer NOT NULL, "degree" text NOT NULL,
  "major_id" uuid REFERENCES "majors"("id"), "other_major" text, "accept_nationwide" boolean NOT NULL DEFAULT false,
  "accept_any_major" boolean NOT NULL DEFAULT false, "preference_types" jsonb NOT NULL DEFAULT '[]',
  "reminder_preference" jsonb NOT NULL DEFAULT '[]', "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "recruitment_project_majors" (
  "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"), "major_id" uuid NOT NULL REFERENCES "majors"("id"),
  "match_weight" integer NOT NULL DEFAULT 100, PRIMARY KEY ("project_id", "major_id")
);
CREATE TABLE "recruitment_project_regions" (
  "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"), "region_id" uuid NOT NULL REFERENCES "regions"("id"),
  PRIMARY KEY ("project_id", "region_id")
);
CREATE TABLE "favorites" (
  "user_id" uuid NOT NULL REFERENCES "users"("id"), "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  PRIMARY KEY ("user_id", "project_id")
);
CREATE TABLE "application_trackers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"), "status" "application_status" NOT NULL DEFAULT '暂未处理',
  "note" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  UNIQUE ("user_id", "project_id")
);
CREATE TABLE "reminder_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"), "on_start" boolean NOT NULL DEFAULT true,
  "before_days" jsonb NOT NULL DEFAULT '[7,3,1]', "on_change" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz,
  UNIQUE ("user_id", "project_id")
);
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "recruitment_projects"("id"), "type" text NOT NULL, "title" text NOT NULL, "body" text NOT NULL,
  "read_at" timestamptz, "scheduled_for" timestamptz, "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX "notifications_user_read_idx" ON "notifications" ("user_id", "read_at");
CREATE TABLE "recruitment_changes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"),
  "changed_by" uuid REFERENCES "users"("id"), "change_type" text NOT NULL, "before_data" jsonb, "after_data" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "correction_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "project_id" uuid NOT NULL REFERENCES "recruitment_projects"("id"),
  "user_id" uuid REFERENCES "users"("id"), "type" "correction_type" NOT NULL, "content" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending', "reviewed_by" uuid REFERENCES "users"("id"), "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "admin_users" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id"), "role" text NOT NULL DEFAULT 'editor',
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE TABLE "system_configs" (
  "key" text PRIMARY KEY, "value" jsonb NOT NULL, "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);

INSERT INTO "system_configs" ("key", "value", "description") VALUES
  ('site_name', '"校招雷达"', '前台产品名称'),
  ('focus_graduation_year', '2027', '当前重点毕业年份'),
  ('recruitment_cutoff_days', '7', '即将截止的天数阈值')
ON CONFLICT ("key") DO NOTHING;
