-- 037_add_subscription_plan.sql
-- Reintroduce subscription plan tracking for enforcing pickup quotas.
-- Plans: free (Essentiel, limited), plus / pro (unlimited).

ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_subscription_plan_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_subscription_plan_check
    CHECK (subscription_plan IN ('free', 'plus', 'pro'));
  END IF;
END $$;

COMMENT ON COLUMN users.subscription_plan
  IS 'Subscription plan key (free | plus | pro) enforcing pickup request limits.';