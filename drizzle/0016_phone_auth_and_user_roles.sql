-- Phone/password authentication and the two application-level user roles.
-- Existing users and admin_users rows are preserved; admin_users remains as a
-- compatibility mapping while users.role becomes the canonical role.

DO $$
BEGIN
  CREATE TYPE "user_role" AS ENUM ('admin', 'customer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS "name" text,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';

UPDATE "users" u
SET "role" = 'admin'
WHERE EXISTS (
  SELECT 1 FROM "admin_users" a WHERE a."user_id" = u."id"
);

UPDATE "users"
SET "role" = 'customer'
WHERE "role" IS NULL;

CREATE INDEX IF NOT EXISTS "users_role_status_idx"
  ON "users" ("role", "status");

-- The existing unique phone index already prevents duplicate phone accounts.
-- Keep the legacy admin_users rows intact so existing admin API relationships
-- and audit references continue to work during the auth transition.
