ALTER TABLE platform_profiles
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'KE',
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS university text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES';

ALTER TABLE fundi_profiles
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'KE',
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '';

UPDATE fundi_profiles
SET region = county
WHERE region = '' AND county <> '';

ALTER TABLE hub_listings
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'KE',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS university text NOT NULL DEFAULT '';

UPDATE hub_listings
SET city = town
WHERE city = '' AND town <> '';

UPDATE hub_listings
SET region = county
WHERE region = '' AND county <> '';

CREATE INDEX IF NOT EXISTS idx_hub_listings_global_location
  ON hub_listings(country, city, region, university, status);

CREATE INDEX IF NOT EXISTS idx_fundi_profiles_global_location
  ON fundi_profiles(country, town, region);
