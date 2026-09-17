-- 032_collector_verification_status.sql
-- Adds collector verification lifecycle fields for admin approval workflow.

DO $$
BEGIN
  CREATE TYPE collector_verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS collector_verification_status collector_verification_status NOT NULL DEFAULT 'approved';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS collector_verification_note text;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS collector_submitted_at timestamptz;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS collector_verified_at timestamptz;

COMMENT ON COLUMN users.collector_verification_status IS 'Collector application state: pending, approved, rejected.';
COMMENT ON COLUMN users.collector_verification_note IS 'Admin review note, including rejection reason.';
COMMENT ON COLUMN users.collector_submitted_at IS 'Timestamp when collector details were submitted.';
COMMENT ON COLUMN users.collector_verified_at IS 'Timestamp when admin reviewed collector application.';

UPDATE users
SET collector_submitted_at = COALESCE(collector_submitted_at, created_at),
    collector_verified_at = COALESCE(collector_verified_at, created_at)
WHERE role = 'collector'
  AND collector_verification_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_users_collector_verification_status
  ON users (collector_verification_status);

CREATE INDEX IF NOT EXISTS idx_users_collector_verification_pending
  ON users (collector_verification_status, created_at DESC)
  WHERE role = 'collector' AND collector_verification_status = 'pending';
