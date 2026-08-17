ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS recruitment_link_status text NOT NULL DEFAULT 'NEEDS_REVIEW';

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS display_type text NOT NULL DEFAULT 'RECRUITMENT_PROJECT';

CREATE INDEX IF NOT EXISTS data_sources_recruitment_link_status_idx
  ON data_sources (recruitment_link_status);

CREATE INDEX IF NOT EXISTS opportunities_display_type_idx
  ON opportunities (display_type);
