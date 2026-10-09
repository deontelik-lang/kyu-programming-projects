-- Opt-in public directory for CampusConnect profiles; private by default.
ALTER TABLE platform_profiles
  ADD COLUMN IF NOT EXISTS public_directory boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_platform_profiles_public_campus
  ON platform_profiles(public_directory, campus, persona, updated_at DESC);
