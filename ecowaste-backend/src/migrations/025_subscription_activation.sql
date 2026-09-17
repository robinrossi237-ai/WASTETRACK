-- 025_subscription_activation.sql
-- Track subscription activation status and request types.

DO $$
BEGIN
  CREATE TYPE subscription_request_type AS ENUM ('change', 'activation');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE subscription_change_requests
ADD COLUMN IF NOT EXISTS request_type subscription_request_type NOT NULL DEFAULT 'change';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN users.subscription_active IS 'Whether the current subscription plan is active (verified by admin).';

CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_type
  ON subscription_change_requests (request_type);
