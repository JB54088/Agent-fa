-- Official URL registration and publication are separate operator actions.
ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS official_url_status text NOT NULL DEFAULT 'UNREGISTERED',
  ADD COLUMN IF NOT EXISTS official_url_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS official_url_registered_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS official_url_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS official_url_published_by uuid REFERENCES users(id);

CREATE INDEX IF NOT EXISTS data_sources_official_url_status_idx
  ON data_sources (official_url_status);
