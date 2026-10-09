-- CampusConnect + FundiConnect super-app hub layer.
CREATE TABLE IF NOT EXISTS platform_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  persona text NOT NULL DEFAULT 'customer' CHECK (persona IN ('student','worker','customer','business','employer','alumni')),
  headline text NOT NULL DEFAULT '',
  campus text NOT NULL DEFAULT '',
  course text NOT NULL DEFAULT '',
  study_level text NOT NULL DEFAULT '',
  graduation_year integer CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1990 AND 2100),
  bio text NOT NULL DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  organisation text NOT NULL DEFAULT '',
  portfolio_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_profiles(id,user_id,persona,headline)
SELECT gen_random_uuid(), u.id,
       CASE WHEN u.role='fundi' THEN 'worker' ELSE 'customer' END,
       ''
FROM users u
ON CONFLICT(user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS hub_listings (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hub_type text NOT NULL CHECK (hub_type IN ('student_gig','job','internship','housing','product','event','course','business','community','transport','student_service','alumni','service_offer')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 140),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  category text NOT NULL DEFAULT '',
  county text NOT NULL DEFAULT '',
  town text NOT NULL DEFAULT '',
  price numeric(12,2) CHECK (price IS NULL OR price >= 0),
  currency char(3) NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','closed','hidden')),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_listings_type_status_created ON hub_listings(hub_type,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_listings_location ON hub_listings(county,town,status);
CREATE INDEX IF NOT EXISTS idx_hub_listings_owner_created ON hub_listings(owner_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_listings_search ON hub_listings USING gin (to_tsvector('simple',title || ' ' || description || ' ' || category));

CREATE TABLE IF NOT EXISTS hub_listing_actions (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES hub_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('save','apply','inquire','attend','enroll','book','mentor')),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewed','accepted','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id,user_id,action)
);
CREATE INDEX IF NOT EXISTS idx_hub_actions_user_created ON hub_listing_actions(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_actions_listing_status ON hub_listing_actions(listing_id,action,status);

CREATE TABLE IF NOT EXISTS hub_comments (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES hub_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_comments_listing_created ON hub_comments(listing_id,created_at);

CREATE TABLE IF NOT EXISTS hub_messages (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES hub_listings(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> recipient_user_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_messages_sender_created ON hub_messages(sender_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_messages_recipient_created ON hub_messages(recipient_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS hub_reports (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES hub_listings(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','fraud','unsafe','misleading','harassment','other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(listing_id,reporter_user_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_reports_status_created ON hub_reports(status,created_at DESC);

CREATE TABLE IF NOT EXISTS emergency_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN ('electrician','plumber','mechanic','locksmith','security','ambulance','internet','cctv','other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 5 AND 1500),
  county text NOT NULL,
  town text NOT NULL,
  contact_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','assigned','resolved','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_status_created ON emergency_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_user_created ON emergency_requests(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points <> 0),
  reason text NOT NULL,
  reference_type text NOT NULL DEFAULT '',
  reference_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_user_created ON reward_ledger(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS hub_favorites (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('fundi','business','listing')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,target_type,target_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_favorites_user ON hub_favorites(user_id,created_at DESC);

