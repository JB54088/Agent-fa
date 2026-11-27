-- Membership schema additions reviewed against the read-only production schema:
-- neondb.public; users/admin_users/admin_audit_logs exist, while the two
-- membership tables do not. Do not apply automatically or through drizzle-kit.
-- If either membership table exists when this is reviewed for execution, stop
-- and audit its actual columns/constraints before proceeding.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.activation_codes') IS NOT NULL
     OR to_regclass('public.membership_transactions') IS NOT NULL THEN
    RAISE EXCEPTION 'Membership table already exists; re-audit its schema before running this one-time SQL';
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_plan text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_membership_plan_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_membership_plan_check
      CHECK (membership_plan IS NULL OR membership_plan IN ('monthly', 'quarterly', 'yearly'));
  END IF;
END $$;

CREATE TABLE public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL,
  code_ciphertext text NOT NULL,
  plan text NOT NULL,
  duration_days integer NOT NULL,
  status text NOT NULL DEFAULT 'unused',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  activated_by_user_id uuid,
  disabled_at timestamptz,
  disabled_by uuid,
  note text,
  CONSTRAINT activation_codes_created_by_users_fk
    FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT activation_codes_activated_by_users_fk
    FOREIGN KEY (activated_by_user_id) REFERENCES public.users(id),
  CONSTRAINT activation_codes_disabled_by_users_fk
    FOREIGN KEY (disabled_by) REFERENCES public.users(id),
  CONSTRAINT activation_codes_plan_check
    CHECK (plan IN ('monthly', 'quarterly', 'yearly')),
  CONSTRAINT activation_codes_duration_check
    CHECK (duration_days IN (30, 90, 365)),
  CONSTRAINT activation_codes_plan_duration_check
    CHECK (
      (plan = 'monthly' AND duration_days = 30)
      OR (plan = 'quarterly' AND duration_days = 90)
      OR (plan = 'yearly' AND duration_days = 365)
    ),
  CONSTRAINT activation_codes_status_check
    CHECK (status IN ('unused', 'used', 'disabled')),
  CONSTRAINT activation_codes_state_check
    CHECK (
      (status = 'unused' AND activated_at IS NULL AND activated_by_user_id IS NULL AND disabled_at IS NULL AND disabled_by IS NULL)
      OR (status = 'used' AND activated_at IS NOT NULL AND activated_by_user_id IS NOT NULL AND disabled_at IS NULL AND disabled_by IS NULL)
      OR (status = 'disabled' AND activated_at IS NULL AND activated_by_user_id IS NULL AND disabled_at IS NOT NULL AND disabled_by IS NOT NULL)
    )
);

CREATE TABLE public.membership_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activation_code_id uuid NOT NULL,
  plan text NOT NULL,
  duration_days integer NOT NULL,
  previous_end_at timestamptz,
  new_end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_transactions_user_users_fk
    FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT membership_transactions_code_fk
    FOREIGN KEY (activation_code_id) REFERENCES public.activation_codes(id),
  CONSTRAINT membership_transactions_plan_duration_check
    CHECK (
      (plan = 'monthly' AND duration_days = 30)
      OR (plan = 'quarterly' AND duration_days = 90)
      OR (plan = 'yearly' AND duration_days = 365)
    ),
  CONSTRAINT membership_transactions_end_after_previous_check
    CHECK (previous_end_at IS NULL OR new_end_at > previous_end_at)
);

-- code_hash's unique index is the redemption lookup and duplicate-code guard.
CREATE UNIQUE INDEX activation_codes_code_hash_uidx
  ON public.activation_codes (code_hash);
CREATE INDEX activation_codes_status_created_idx
  ON public.activation_codes (status, created_at DESC);
CREATE INDEX activation_codes_plan_status_idx
  ON public.activation_codes (plan, status);
CREATE INDEX activation_codes_activated_by_idx
  ON public.activation_codes (activated_by_user_id);
CREATE UNIQUE INDEX membership_transactions_activation_code_uidx
  ON public.membership_transactions (activation_code_id);
CREATE INDEX membership_transactions_user_created_idx
  ON public.membership_transactions (user_id, created_at DESC);

COMMIT;
