-- Expand the persistent hub catalogue to cover global study opportunities and creator/media posts.
-- Drop only check constraints whose definition mentions hub_type, regardless of generated constraint name.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.hub_listings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%hub_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.hub_listings DROP CONSTRAINT %I', item.conname);
  END LOOP;
END $$;

ALTER TABLE public.hub_listings
  ADD CONSTRAINT hub_listings_hub_type_check
  CHECK (hub_type IN (
    'student_gig','job','internship','housing','product','event','course',
    'business','community','transport','student_service','alumni','service_offer',
    'scholarship','study_abroad','language_exchange','lost_found','student_discount','club',
    'media_video','music','podcast','student_original','creator'
  ));

CREATE INDEX IF NOT EXISTS idx_hub_listings_creator_and_global_types
  ON public.hub_listings(hub_type, country, status, created_at DESC)
  WHERE status = 'published';
