-- 022_weight_based_pricing.sql
-- Add weight-based pricing fields and waste type fee settings.

ALTER TABLE pickup_requests
  ADD COLUMN IF NOT EXISTS weight_kg numeric(8, 2);

ALTER TABLE pickup_requests
  DROP CONSTRAINT IF EXISTS pickup_requests_weight_check;

ALTER TABLE pickup_requests
  ADD CONSTRAINT pickup_requests_weight_check CHECK (
    weight_kg IS NULL OR weight_kg >= 0
  );

COMMENT ON COLUMN pickup_requests.weight_kg IS 'Estimated pickup weight in kilograms used for pricing.';

ALTER TABLE pricing_settings
  ADD COLUMN IF NOT EXISTS waste_type_fees jsonb NOT NULL DEFAULT '{
    "household": {"base_fee": 500, "per_kg": 50},
    "plastic": {"base_fee": 400, "per_kg": 40},
    "organic": {"base_fee": 350, "per_kg": 35},
    "electronic": {"base_fee": 800, "per_kg": 80},
    "hazardous": {"base_fee": 1000, "per_kg": 100},
    "metal": {"base_fee": 450, "per_kg": 45},
    "mixed": {"base_fee": 650, "per_kg": 65}
  }'::jsonb;

COMMENT ON COLUMN pricing_settings.waste_type_fees IS 'Per-waste-type base and per-kg fees.';

UPDATE pricing_settings
SET waste_type_fees = COALESCE(
  waste_type_fees,
  '{
    "household": {"base_fee": 500, "per_kg": 50},
    "plastic": {"base_fee": 400, "per_kg": 40},
    "organic": {"base_fee": 350, "per_kg": 35},
    "electronic": {"base_fee": 800, "per_kg": 80},
    "hazardous": {"base_fee": 1000, "per_kg": 100},
    "metal": {"base_fee": 450, "per_kg": 45},
    "mixed": {"base_fee": 650, "per_kg": 65}
  }'::jsonb
);
