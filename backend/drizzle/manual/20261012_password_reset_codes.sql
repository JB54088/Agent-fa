-- Stores only a keyed HMAC of each code; the SMS code itself is never persisted.
-- Apply manually after reviewing the target database. Do not run drizzle-kit migrate.

CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_codes_attempts_check CHECK (attempts BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS password_reset_codes_phone_created_idx
  ON public.password_reset_codes (phone, created_at DESC);
