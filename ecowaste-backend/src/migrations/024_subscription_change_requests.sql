-- 024_subscription_change_requests.sql
-- Track subscription plan change payments awaiting admin verification.

DO $$
BEGIN
  CREATE TYPE subscription_change_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS subscription_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_plan text,
  to_plan text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  status subscription_change_status NOT NULL DEFAULT 'pending',
  payment_proof_url text,
  reviewed_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subscription_change_requests IS 'User subscription plan change requests with payment proof.';
COMMENT ON COLUMN subscription_change_requests.payment_proof_url IS 'Base64 or URL for payment proof screenshot.';

CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_user_id
  ON subscription_change_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_status
  ON subscription_change_requests (status);

DROP TRIGGER IF EXISTS trg_subscription_change_requests_set_updated_at ON subscription_change_requests;

CREATE TRIGGER trg_subscription_change_requests_set_updated_at
BEFORE UPDATE ON subscription_change_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
