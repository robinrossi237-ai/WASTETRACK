-- 034_cleanup_free_mode.sql
-- Remove legacy payment/subscription schema and keep only free-flow operational data.

-- New lightweight app-level settings for public client configuration.
CREATE TABLE IF NOT EXISTS app_settings (
  scope text PRIMARY KEY,
  whatsapp_message_template text NOT NULL DEFAULT 'Hello {collector_name}, I am tracking my pickup for {pickup_address}.',
  updated_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_app_settings_set_updated_at ON app_settings;

CREATE TRIGGER trg_app_settings_set_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO app_settings (scope, whatsapp_message_template)
VALUES ('default', 'Hello {collector_name}, I am tracking my pickup for {pickup_address}.')
ON CONFLICT (scope) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pricing_settings'
  ) THEN
    INSERT INTO app_settings (scope, whatsapp_message_template)
    SELECT
      'default',
      COALESCE(
        NULLIF(trim(ps.whatsapp_message_template), ''),
        'Hello {collector_name}, I am tracking my pickup for {pickup_address}.'
      )
    FROM pricing_settings ps
    WHERE ps.scope = 'default'
    ON CONFLICT (scope) DO UPDATE
      SET whatsapp_message_template = EXCLUDED.whatsapp_message_template;
  END IF;
END $$;

-- Analytics view cleanup: remove payment-dependent artifacts.
DROP MATERIALIZED VIEW IF EXISTS mv_payment_aging;

DROP MATERIALIZED VIEW IF EXISTS mv_pickup_sla;

CREATE MATERIALIZED VIEW mv_pickup_sla AS
SELECT
  p.id,
  p.status,
  p.created_at,
  p.scheduled_date,
  a.assigned_at,
  a.started_at,
  a.completed_at,
  EXTRACT(EPOCH FROM (a.assigned_at - p.created_at)) / 3600 AS hours_to_assign,
  EXTRACT(EPOCH FROM (a.started_at - a.assigned_at)) / 3600 AS hours_to_start,
  EXTRACT(EPOCH FROM (a.completed_at - a.started_at)) / 3600 AS hours_to_complete
FROM pickup_requests p
LEFT JOIN collector_assignments a ON a.pickup_request_id = p.id;

CREATE INDEX IF NOT EXISTS idx_mv_pickup_sla_status ON mv_pickup_sla (status);

-- Remove pricing/payment columns no longer needed in free mode.
ALTER TABLE pickup_requests
  DROP CONSTRAINT IF EXISTS pickup_requests_weight_check,
  DROP COLUMN IF EXISTS weight_kg,
  DROP COLUMN IF EXISTS price_amount,
  DROP COLUMN IF EXISTS price_currency;

ALTER TABLE users
  DROP COLUMN IF EXISTS subscription_plan,
  DROP COLUMN IF EXISTS subscription_active;

-- Drop legacy billing tables.
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS subscription_change_requests;
DROP TABLE IF EXISTS pricing_settings;

-- Drop now-unused enum types.
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS subscription_change_status;
DROP TYPE IF EXISTS subscription_request_type;
