-- Organization-level INITIAL_SYNC state. A status means the monitoring object
-- has been processed; it does not imply a recruitment opportunity exists.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS initial_sync_status text NOT NULL DEFAULT 'NOT_CHECKED',
  ADD COLUMN IF NOT EXISTS initial_sync_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS initial_sync_next_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS initial_sync_official_url text,
  ADD COLUMN IF NOT EXISTS initial_sync_recruitment_url text,
  ADD COLUMN IF NOT EXISTS initial_sync_failure_type text,
  ADD COLUMN IF NOT EXISTS initial_sync_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS initial_sync_last_result jsonb,
  ADD COLUMN IF NOT EXISTS initial_sync_batch text,
  ADD COLUMN IF NOT EXISTS initial_sync_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS organizations_initial_sync_status_idx
  ON organizations (monitoring_enabled, initial_sync_status, priority);

CREATE TABLE IF NOT EXISTS organization_initial_sync_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  batch_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  official_url text,
  recruitment_url text,
  failure_type text,
  retry_count integer NOT NULL DEFAULT 0,
  discovered_count integer NOT NULL DEFAULT 0,
  formal_added integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS organization_initial_sync_checks_org_idx
  ON organization_initial_sync_checks (organization_id, finished_at);
CREATE INDEX IF NOT EXISTS organization_initial_sync_checks_status_idx
  ON organization_initial_sync_checks (status);
