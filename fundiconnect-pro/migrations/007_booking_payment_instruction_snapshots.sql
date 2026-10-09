-- Freeze provider payment instructions on each agreed booking quote.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS direct_payment_instructions_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(direct_payment_instructions_snapshot)='object');
