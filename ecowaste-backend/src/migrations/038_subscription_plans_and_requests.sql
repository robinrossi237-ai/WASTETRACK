-- 038_subscription_plans_and_requests.sql
-- Dynamic subscription plans (admin-managed) + MoMo payment proof requests.
--
-- - plans: id is the slug stored in users.subscription_plan (keeps 'free'/'plus'/'pro' working)
-- - subscription_requests: screenshot proof + admin approve/reject flow
-- - app_settings: MTN/Orange merchant numbers + USSD templates (admin-editable)

-- ---------------------------------------------------------------- plans ---
CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  monthly_limit integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_id_slug CHECK (id ~ '^[a-z0-9-]{2,32}$'),
  CONSTRAINT plans_price_amount_check CHECK (price_amount >= 0),
  CONSTRAINT plans_monthly_limit_check CHECK (monthly_limit IS NULL OR monthly_limit > 0)
);

COMMENT ON TABLE plans IS 'Admin-managed subscription plans. id is referenced by users.subscription_plan.';
COMMENT ON COLUMN plans.monthly_limit IS 'Monthly pickup allowance. NULL means unlimited.';

DROP TRIGGER IF EXISTS trg_plans_set_updated_at ON plans;

CREATE TRIGGER trg_plans_set_updated_at
BEFORE UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans (is_active);

INSERT INTO plans (id, name, price_amount, currency, monthly_limit, features, is_active)
VALUES
  ('free', 'Essentiel', 0, 'XOF', 3,
   '["3 ramassages gratuits / mois", "Suivi ETA en direct", "Signalement d''incivilités", "Cumul de points"]'::jsonb,
   true),
  ('plus', 'Plus', 1500, 'XOF', NULL,
   '["Ramassages illimités", "Planification récurrente", "Ramassages priorisés", "Bonus de points x2", "Support prioritaire"]'::jsonb,
   true),
  ('pro', 'Pro', 3500, 'XOF', NULL,
   '["Tout le plan Plus", "Ramassage de gros volumes", "Collecte électronique & encombrants", "Rapport d''impact mensuel", "Bonus de points x3"]'::jsonb,
   true)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------- link users.subscription_plan to plans ---
UPDATE users
SET subscription_plan = 'free'
WHERE subscription_plan IS NULL
   OR trim(subscription_plan) = ''
   OR subscription_plan NOT IN ('free', 'plus', 'pro');

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_subscription_plan_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_subscription_plan_fkey'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_subscription_plan_fkey
    FOREIGN KEY (subscription_plan) REFERENCES plans (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
  END IF;
END $$;

-- ------------------------------------------------- subscription requests ---
DO $$
BEGIN
  CREATE TYPE subscription_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  payment_method text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  proof_url text,
  status subscription_request_status NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_requests_payment_method_check
    CHECK (payment_method IN ('mtn', 'orange')),
  CONSTRAINT subscription_requests_amount_check CHECK (amount >= 0),
  CONSTRAINT subscription_requests_proof_required_for_paid
    CHECK (
      amount = 0
      OR (proof_url IS NOT NULL AND length(trim(proof_url)) > 0)
    ),
  CONSTRAINT subscription_requests_review_consistency CHECK (
    (status = 'pending' AND reviewed_by_admin_id IS NULL AND reviewed_at IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_by_admin_id IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT subscription_requests_reject_needs_note CHECK (
    status <> 'rejected'
    OR (admin_note IS NOT NULL AND length(trim(admin_note)) >= 2)
  )
);

COMMENT ON TABLE subscription_requests IS 'MoMo payment proof requests for plan changes, validated by admins.';
COMMENT ON COLUMN subscription_requests.proof_url IS 'URL of the uploaded payment screenshot (via /api/uploads).';

CREATE INDEX IF NOT EXISTS idx_subscription_requests_user_id
  ON subscription_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_status
  ON subscription_requests (status);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_plan_id
  ON subscription_requests (plan_id);

DROP TRIGGER IF EXISTS trg_subscription_requests_set_updated_at ON subscription_requests;

CREATE TRIGGER trg_subscription_requests_set_updated_at
BEFORE UPDATE ON subscription_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------- payment settings ---
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS mtn_merchant_number text NOT NULL DEFAULT '652605329',
  ADD COLUMN IF NOT EXISTS orange_merchant_number text NOT NULL DEFAULT '659106128',
  ADD COLUMN IF NOT EXISTS mtn_ussd_template text NOT NULL DEFAULT '*126*1*652605329*{amount}#',
  ADD COLUMN IF NOT EXISTS orange_ussd_template text NOT NULL DEFAULT '#150*1*659106128*{amount}#';

COMMENT ON COLUMN app_settings.mtn_merchant_number IS 'MTN MoMo merchant number shown to residents.';
COMMENT ON COLUMN app_settings.orange_merchant_number IS 'Orange Money merchant number shown to residents.';
COMMENT ON COLUMN app_settings.mtn_ussd_template IS 'USSD template for MTN payments. Must include {amount}.';
COMMENT ON COLUMN app_settings.orange_ussd_template IS 'USSD template for Orange payments. Must include {amount}.';
