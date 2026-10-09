-- Direct-to-provider payments, two-sided confirmations, disputes, trust review, and policy acceptance.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS policy_version text NOT NULL DEFAULT '';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS direct_payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (direct_payment_status IN ('unpaid','customer_reported_paid','provider_reported_received','confirmed','disputed')),
  ADD COLUMN IF NOT EXISTS direct_payment_method text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_payment_confirmed_at timestamptz;
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS direct_payment_status_before_dispute text
    CHECK (direct_payment_status_before_dispute IS NULL OR direct_payment_status_before_dispute IN ('unpaid','customer_reported_paid','provider_reported_received','confirmed'));

CREATE TABLE IF NOT EXISTS provider_payment_instructions (
  fundi_id uuid PRIMARY KEY REFERENCES fundi_profiles(id) ON DELETE CASCADE,
  accepted_methods text[] NOT NULL DEFAULT '{}',
  mpesa_till text NOT NULL DEFAULT '',
  mpesa_paybill text NOT NULL DEFAULT '',
  paybill_account text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  bank_details text NOT NULL DEFAULT '',
  other_instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_events (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_events_booking_created ON booking_events(booking_id,created_at,id);

CREATE TABLE IF NOT EXISTS booking_disputes (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('payment','quality','missed_appointment','scope_or_price','safety','communication','other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 3000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  resolution_note text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_booking_disputes_status_created ON booking_disputes(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_disputes_booking_created ON booking_disputes(booking_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_one_active_dispute
  ON booking_disputes(booking_id) WHERE status IN ('open','reviewing');

CREATE TABLE IF NOT EXISTS fundi_reports (
  id uuid PRIMARY KEY,
  fundi_id uuid NOT NULL REFERENCES fundi_profiles(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','fraud','unsafe','misleading','harassment','other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','resolved','dismissed')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_note text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fundi_reports_status_created ON fundi_reports(status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fundi_reporter_once
  ON fundi_reports(fundi_id,reporter_user_id);

CREATE TABLE IF NOT EXISTS fundi_verification_checks (
  id uuid PRIMARY KEY,
  fundi_id uuid NOT NULL REFERENCES fundi_profiles(id) ON DELETE CASCADE,
  check_type text NOT NULL CHECK (check_type IN ('identity','phone','qualification','portfolio','reference')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  evidence_note text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fundi_id,check_type)
);
CREATE INDEX IF NOT EXISTS idx_fundi_verification_checks_fundi ON fundi_verification_checks(fundi_id,status);
