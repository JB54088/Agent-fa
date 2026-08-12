import { neon } from "@neondatabase/serverless";

export type OfficialUrlStatus = "UNREGISTERED" | "REGISTERED" | "PUBLISHED";

type SqlClient = ReturnType<typeof neon>;

/** Ensures the two-step official URL lifecycle exists in an existing production database. */
export async function ensureOfficialUrlLifecycle(sql: SqlClient) {
  await sql`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS display_type text NOT NULL DEFAULT 'RECRUITMENT_PROJECT'`;
  await sql`
    ALTER TABLE data_sources
      ADD COLUMN IF NOT EXISTS official_url_status text NOT NULL DEFAULT 'UNREGISTERED',
      ADD COLUMN IF NOT EXISTS official_url_registered_at timestamptz,
      ADD COLUMN IF NOT EXISTS official_url_registered_by uuid REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS official_url_published_at timestamptz,
      ADD COLUMN IF NOT EXISTS official_url_published_by uuid REFERENCES users(id)
  `;
  await sql`CREATE INDEX IF NOT EXISTS data_sources_official_url_status_idx ON data_sources (official_url_status)`;
  // The duplicate cleanup must never remove a previously published official
  // entry. Restore those entries first so the subsequent deduplication step
  // sees them as protected history.
  await sql`
    UPDATE opportunities
    SET publication_status = 'published', updated_at = now()
    WHERE display_type = 'OFFICIAL_RECRUITMENT_ENTRY'
      AND publication_status = 'withdrawn'
      AND is_demo = false
      AND opportunity_relevance_status = 'PUBLIC_NOTICE'
  `;
  // Preserve sources previously confirmed through the old single-step UI before
  // ranking duplicates, so a confirmed record always wins its duplicate group.
  await sql`
    UPDATE data_sources
    SET official_url_status = 'PUBLISHED',
        official_url_published_at = COALESCE(official_url_published_at, source_last_verified_at, updated_at)
    WHERE official_url_status = 'UNREGISTERED'
      AND source_url IS NOT NULL
      AND admin_note LIKE '%[manual-review-confirmed:%'
  `;
  await sql`
    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY organization_id, lower(regexp_replace(COALESCE(source_url, list_page_url), '/+$', ''))
               ORDER BY
                 CASE WHEN official_url_status = 'PUBLISHED' THEN 0 WHEN official_url_status = 'REGISTERED' THEN 1 ELSE 2 END,
                 CASE WHEN source_url IS NOT NULL THEN 0 ELSE 1 END,
                 updated_at DESC,
                 id
             ) AS duplicate_rank
      FROM data_sources
      WHERE status = 'active'
        AND admin_note LIKE '%source-directory-sync%'
        AND organization_id IS NOT NULL
        AND COALESCE(source_url, list_page_url) IS NOT NULL
    )
    UPDATE data_sources d
    SET status = 'invalid', discovery_status = 'INACTIVE', automation_allowed = false,
        incremental_sync_enabled = false,
        admin_note = concat(coalesce(d.admin_note, ''), ' [duplicate-source-archived:', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), ']'),
        updated_at = now()
    FROM ranked r
    WHERE d.id = r.id AND r.duplicate_rank > 1
      AND NOT EXISTS (
        SELECT 1 FROM opportunities o
        WHERE o.source_id = d.id AND o.publication_status = 'published'
      )
  `;
}
