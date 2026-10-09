-- M-Pesa STK Push transaction tracking. Successful payment status is written only from verified provider callbacks.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid','pending','paid','failed'));

CREATE TABLE IF NOT EXISTS mpesa_payments (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount BETWEEN 1 AND 1000000000),
  phone_number text NOT NULL CHECK (phone_number ~ '^254[17][0-9]{8}$'),
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  status text NOT NULL DEFAULT 'initiating'
    CHECK (status IN ('initiating','pending','paid','failed','cancelled')),
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  mpesa_receipt_number text UNIQUE,
  result_code text,
  result_description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mpesa_payments_user_created
  ON mpesa_payments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_payments_booking_created
  ON mpesa_payments(booking_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_payments_status_created
  ON mpesa_payments(status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mpesa_one_open_payment_per_booking
  ON mpesa_payments(booking_id) WHERE status IN ('initiating','pending');
