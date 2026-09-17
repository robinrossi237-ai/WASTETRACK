-- 023_add_plan_change_fee.sql
-- Adds a flat fee for subscription plan changes.

ALTER TABLE pricing_settings
  ADD COLUMN IF NOT EXISTS plan_change_fee numeric(12, 2) NOT NULL DEFAULT 500;

COMMENT ON COLUMN pricing_settings.plan_change_fee IS 'Flat fee charged when a user changes subscription plans.';

UPDATE pricing_settings
SET plan_change_fee = 500
WHERE plan_change_fee IS NULL;
