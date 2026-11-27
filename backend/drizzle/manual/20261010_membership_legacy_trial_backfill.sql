-- One-time legacy-customer trial initialization. This file requires psql and a
-- fixed, approved rollout timestamp; it intentionally refuses to run without it.
-- Example (choose the real rollout time, do not use now()):
--   psql "$DATABASE_URL" -v membership_launch_at='<approved fixed timestamp with timezone>' -f this-file.sql
\if :{?membership_launch_at}
BEGIN;

WITH rollout AS (
  SELECT :'membership_launch_at'::timestamptz AS started_at
)
UPDATE public.users AS account
SET trial_started_at = rollout.started_at,
    trial_ends_at = rollout.started_at + interval '72 hours',
    updated_at = now()
FROM rollout
WHERE account.role = 'customer'
  AND account.trial_started_at IS NULL
  AND account.trial_ends_at IS NULL
  AND account.membership_started_at IS NULL
  AND account.membership_ends_at IS NULL
  AND account.membership_plan IS NULL;

COMMIT;
\else
\echo 'Refusing to run: supply a fixed -v membership_launch_at=<timestamp with timezone>'
\quit 3
\endif
