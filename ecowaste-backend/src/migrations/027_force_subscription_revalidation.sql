-- 027_force_subscription_revalidation.sql
-- Require existing paid-plan residents to re-validate their subscriptions.

UPDATE users
SET subscription_active = false
WHERE role = 'resident'
  AND subscription_plan IS NOT NULL
  AND subscription_plan <> 'payg'
  AND subscription_active IS DISTINCT FROM false;
