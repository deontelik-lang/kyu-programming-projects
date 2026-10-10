-- Smart job requests, quote comparison, and provider portfolio/business toolkit.
CREATE TABLE IF NOT EXISTS job_requests (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  service_title text NOT NULL CHECK (char_length(service_title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 5 AND 3000),
  county text NOT NULL DEFAULT '',
  town text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  priority text NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','awarded','cancelled','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_requests_open_location ON job_requests(status,county,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_requests_customer_created ON job_requests(customer_id,created_at DESC);

CREATE TABLE IF NOT EXISTS job_request_providers (
  request_id uuid NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  fundi_id uuid NOT NULL REFERENCES fundi_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','quoted','declined','selected','closed')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  PRIMARY KEY(request_id,fundi_id)
);
CREATE INDEX IF NOT EXISTS idx_request_providers_fundi_status ON job_request_providers(fundi_id,status,invited_at DESC);

CREATE TABLE IF NOT EXISTS job_quotes (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  fundi_id uuid NOT NULL REFERENCES fundi_profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1200),
  estimated_start_at timestamptz,
  payment_instructions_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payment_instructions_snapshot)='object'),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','declined','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,fundi_id)
);
CREATE INDEX IF NOT EXISTS idx_job_quotes_request_status ON job_quotes(request_id,status,amount);
CREATE INDEX IF NOT EXISTS idx_job_quotes_fundi_created ON job_quotes(fundi_id,created_at DESC);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS job_request_id uuid REFERENCES job_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_quote_id uuid REFERENCES job_quotes(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_job_quote
  ON bookings(job_quote_id) WHERE job_quote_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS fundi_portfolio_items (
  id uuid PRIMARY KEY,
  fundi_id uuid NOT NULL REFERENCES fundi_profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1200),
  county text NOT NULL DEFAULT '',
  completed_year integer CHECK (completed_year IS NULL OR completed_year BETWEEN 1950 AND 2100),
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fundi_portfolio_public ON fundi_portfolio_items(fundi_id,is_public,created_at DESC);
