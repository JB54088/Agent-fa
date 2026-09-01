-- Long-lived recruitment source pool. This migration only adds columns and
-- tables; it does not delete or replace any existing source or organization.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS pool_normalized_name text,
  ADD COLUMN IF NOT EXISTS pool_aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pool_category text,
  ADD COLUMN IF NOT EXISTS pool_subcategory text,
  ADD COLUMN IF NOT EXISTS pool_organization_fingerprint text,
  ADD COLUMN IF NOT EXISTS pool_official_status text,
  ADD COLUMN IF NOT EXISTS pool_first_discovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS pool_last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pool_discovery_method text,
  ADD COLUMN IF NOT EXISTS pool_discovery_query text,
  ADD COLUMN IF NOT EXISTS pool_discovered_from_url text;

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS pool_category text,
  ADD COLUMN IF NOT EXISTS pool_subcategory text,
  ADD COLUMN IF NOT EXISTS pool_source_type text,
  ADD COLUMN IF NOT EXISTS pool_official_status text,
  ADD COLUMN IF NOT EXISTS pool_website_name text,
  ADD COLUMN IF NOT EXISTS pool_url text,
  ADD COLUMN IF NOT EXISTS pool_career_url text,
  ADD COLUMN IF NOT EXISTS pool_normalized_url text,
  ADD COLUMN IF NOT EXISTS pool_source_fingerprint text,
  ADD COLUMN IF NOT EXISTS pool_first_discovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS pool_last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pool_discovery_method text,
  ADD COLUMN IF NOT EXISTS pool_discovery_query text,
  ADD COLUMN IF NOT EXISTS pool_discovered_from_url text,
  ADD COLUMN IF NOT EXISTS pool_verification_interval_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pool_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS pool_notes text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_pool_fingerprint_uidx
  ON organizations (pool_organization_fingerprint)
  WHERE pool_organization_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS organizations_pool_category_idx
  ON organizations (pool_category);
CREATE UNIQUE INDEX IF NOT EXISTS data_sources_pool_fingerprint_uidx
  ON data_sources (pool_source_fingerprint)
  WHERE pool_source_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS data_sources_pool_category_idx
  ON data_sources (pool_category);
CREATE INDEX IF NOT EXISTS data_sources_pool_normalized_url_idx
  ON data_sources (pool_normalized_url);

CREATE TABLE IF NOT EXISTS discovery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  organization_fingerprint text,
  possible_category text,
  subcategory text,
  parent_organization_id uuid REFERENCES organizations(id),
  parent_organization_name text,
  province text,
  city text,
  discovered_from text NOT NULL,
  discovered_from_url text,
  candidate_url text,
  candidate_normalized_url text,
  queue_fingerprint text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  priority integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  last_error text,
  verified_organization_id uuid REFERENCES organizations(id),
  verified_source_id uuid REFERENCES data_sources(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS discovery_queue_fingerprint_uidx
  ON discovery_queue (queue_fingerprint);
CREATE INDEX IF NOT EXISTS discovery_queue_status_priority_idx
  ON discovery_queue (status, priority);
CREATE INDEX IF NOT EXISTS discovery_queue_category_region_idx
  ON discovery_queue (possible_category, province);
CREATE INDEX IF NOT EXISTS discovery_queue_next_attempt_idx
  ON discovery_queue (next_attempt_at);

CREATE TABLE IF NOT EXISTS discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL DEFAULT 'scheduled',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  max_new_candidates integer NOT NULL DEFAULT 200,
  max_verifications integer NOT NULL DEFAULT 100,
  max_browser_pages integer NOT NULL DEFAULT 100,
  candidates_found integer NOT NULL DEFAULT 0,
  queue_added integer NOT NULL DEFAULT 0,
  verified_sources integer NOT NULL DEFAULT 0,
  new_sources integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  report_path text,
  error_message text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS discovery_runs_started_idx ON discovery_runs (started_at);
CREATE INDEX IF NOT EXISTS discovery_runs_status_idx ON discovery_runs (status);

CREATE TABLE IF NOT EXISTS discovery_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  category text NOT NULL,
  province text NOT NULL DEFAULT '',
  strategy text NOT NULL,
  priority integer NOT NULL DEFAULT 50,
  last_run_at timestamptz,
  result_count integer NOT NULL DEFAULT 0,
  new_source_count integer NOT NULL DEFAULT 0,
  zero_result_streak integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT discovery_queries_query_scope_key UNIQUE (query, category, province)
);
CREATE INDEX IF NOT EXISTS discovery_queries_priority_idx
  ON discovery_queries (priority, last_run_at);

CREATE TABLE IF NOT EXISTS organization_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_organization_id uuid NOT NULL REFERENCES organizations(id),
  child_organization_id uuid NOT NULL REFERENCES organizations(id),
  relation_type text NOT NULL,
  source_url text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT organization_relations_edge_key UNIQUE (parent_organization_id, child_organization_id, relation_type)
);
CREATE INDEX IF NOT EXISTS organization_relations_parent_idx ON organization_relations (parent_organization_id);
CREATE INDEX IF NOT EXISTS organization_relations_child_idx ON organization_relations (child_organization_id);
