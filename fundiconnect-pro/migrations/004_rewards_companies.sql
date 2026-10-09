-- Rewards, listing promotion and corporate accounts.
ALTER TABLE hub_listings ADD COLUMN IF NOT EXISTS featured_until timestamptz;
CREATE INDEX IF NOT EXISTS idx_hub_listings_featured ON hub_listings(featured_until DESC) WHERE featured_until IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_ledger_unique_reference
  ON reward_ledger(user_id, reason, reference_type, reference_id);

CREATE TABLE IF NOT EXISTS company_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_name text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO company_profiles(id,user_id,organization_name,website,description)
SELECT gen_random_uuid(),u.id,COALESCE(pp.organisation,''),COALESCE(pp.portfolio_url,''),COALESCE(pp.bio,'')
FROM users u LEFT JOIN platform_profiles pp ON pp.user_id=u.id
WHERE u.role='company'
ON CONFLICT(user_id) DO NOTHING;
