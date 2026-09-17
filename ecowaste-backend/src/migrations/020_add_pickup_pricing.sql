-- 020_add_pickup_pricing.sql
-- Store pickup pricing and category metadata on requests.

ALTER TABLE pickup_requests
  ADD COLUMN IF NOT EXISTS pickup_category varchar(32) NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS distance_km numeric(8, 2),
  ADD COLUMN IF NOT EXISTS price_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_currency varchar(8) NOT NULL DEFAULT 'XOF';

ALTER TABLE pickup_requests
  DROP CONSTRAINT IF EXISTS pickup_requests_category_check;

ALTER TABLE pickup_requests
  ADD CONSTRAINT pickup_requests_category_check CHECK (
    lower(pickup_category) IN ('standard', 'bulk', 'hazardous')
  );

ALTER TABLE pickup_requests
  DROP CONSTRAINT IF EXISTS pickup_requests_distance_check;

ALTER TABLE pickup_requests
  ADD CONSTRAINT pickup_requests_distance_check CHECK (
    distance_km IS NULL OR distance_km >= 0
  );

COMMENT ON COLUMN pickup_requests.pickup_category IS 'Pricing category for the pickup request.';
COMMENT ON COLUMN pickup_requests.distance_km IS 'Optional distance used for on-demand pricing.';
COMMENT ON COLUMN pickup_requests.price_amount IS 'Computed total price for the pickup request.';
COMMENT ON COLUMN pickup_requests.price_currency IS 'Currency for computed pickup price.';
