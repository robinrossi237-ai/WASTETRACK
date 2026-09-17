-- 018_pricing_settings.sql
-- Add pricing settings and subscription plan tracking.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_plan text;

COMMENT ON COLUMN users.subscription_plan IS 'Optional subscription plan key selected during signup.';

CREATE TABLE IF NOT EXISTS pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'XOF',
  billing_cycle text NOT NULL DEFAULT 'month',
  subscription_plans jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by_admin_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_pricing_settings_set_updated_at ON pricing_settings;

CREATE TRIGGER trg_pricing_settings_set_updated_at
BEFORE UPDATE ON pricing_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO pricing_settings (scope, currency, billing_cycle, subscription_plans)
VALUES (
  'default',
  'XOF',
  'month',
  '[
    {"id":"starter","label":"Starter","caption":"1 pickup/week - Basic support","price":3000,"pickups_per_week":1,"included_kg":5,"badge":null,"features":["Weekly pickup","Includes 5kg per pickup","Standard response time"],"active":true},
    {"id":"standard","label":"Standard","caption":"2 pickups/week - Priority windows","price":5000,"pickups_per_week":2,"included_kg":10,"badge":"Most popular","features":["Two pickups weekly","Includes 10kg per pickup","Priority time windows"],"active":true},
    {"id":"family","label":"Family","caption":"3 pickups/week - Larger bin","price":8000,"pickups_per_week":3,"included_kg":15,"badge":null,"features":["Three pickups weekly","Includes 15kg per pickup","Best for larger homes"],"active":true},
    {"id":"payg","label":"Pay as you go","caption":"Pay per pickup - No monthly fee","price":0,"pickups_per_week":0,"included_kg":0,"badge":null,"features":["No subscription commitment","Pay at pickup (cash)","Best for occasional users"],"active":true}
  ]'::jsonb
)
ON CONFLICT (scope) DO NOTHING;
