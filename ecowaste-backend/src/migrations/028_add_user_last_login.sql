-- 028_add_user_last_login.sql
-- Track most recent successful login per account for admin activity monitoring.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

COMMENT ON COLUMN users.last_login_at IS 'Most recent successful authentication timestamp.';
