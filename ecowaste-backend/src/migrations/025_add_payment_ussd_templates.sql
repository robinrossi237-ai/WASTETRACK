-- 025_add_payment_ussd_templates.sql
-- Add editable USSD templates for resident payment flows.

ALTER TABLE pricing_settings
  ADD COLUMN IF NOT EXISTS payment_ussd_templates jsonb NOT NULL DEFAULT
  '{"mobile_money":"*126*1*1*677420606*{amount}#","orange_money":"#150*1*659106128*{amount}#"}'::jsonb;

COMMENT ON COLUMN pricing_settings.payment_ussd_templates IS
  'USSD templates for wallet payments. Template must include {amount}.';

UPDATE pricing_settings
SET payment_ussd_templates = COALESCE(
  payment_ussd_templates,
  '{"mobile_money":"*126*1*1*677420606*{amount}#","orange_money":"#150*1*659106128*{amount}#"}'::jsonb
);
