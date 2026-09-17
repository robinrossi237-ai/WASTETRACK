-- 019_extend_pricing_settings.sql
-- Extend pricing settings and enforce FCFA currency.

ALTER TABLE pricing_settings
ALTER COLUMN currency SET DEFAULT 'XOF';

ALTER TABLE pricing_settings
ADD COLUMN IF NOT EXISTS on_demand_fees jsonb NOT NULL DEFAULT '{"base_fee":0,"distance_fee_per_km":0,"included_radius_km":0}'::jsonb,
ADD COLUMN IF NOT EXISTS bulk_fees jsonb NOT NULL DEFAULT '{"base_fee":0,"volume_multiplier":1}'::jsonb,
ADD COLUMN IF NOT EXISTS hazardous_fees jsonb NOT NULL DEFAULT '{"base_fee":0,"handling_surcharge":0}'::jsonb;

COMMENT ON COLUMN pricing_settings.on_demand_fees IS 'Pricing for standard on-demand pickups.';
COMMENT ON COLUMN pricing_settings.bulk_fees IS 'Pricing for bulk pickups.';
COMMENT ON COLUMN pricing_settings.hazardous_fees IS 'Pricing for hazardous/e-waste pickups.';

UPDATE pricing_settings
SET
  currency = 'XOF',
  on_demand_fees = COALESCE(on_demand_fees, '{"base_fee":0,"distance_fee_per_km":0,"included_radius_km":0}'::jsonb),
  bulk_fees = COALESCE(bulk_fees, '{"base_fee":0,"volume_multiplier":1}'::jsonb),
  hazardous_fees = COALESCE(hazardous_fees, '{"base_fee":0,"handling_surcharge":0}'::jsonb);
