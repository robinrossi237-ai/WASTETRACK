-- 001_create_enums.sql
-- Core extensions, enum types, and shared helpers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum types are created with a safe-guard for dev environments where the DB
-- might already contain them (e.g., manual setup). In production, migrations
-- are expected to be applied once and tracked via schema_migrations.

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('resident', 'collector', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE report_status AS ENUM ('reported', 'verified', 'assigned', 'cleaned', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE pickup_status AS ENUM (
    'pending',
    'payment_uploaded',
    'approved',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE reward_reason AS ENUM ('waste_report', 'pickup_participation', 'cleanup_verified', 'bonus');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE user_role IS 'Roles for platform users.';
COMMENT ON TYPE report_status IS 'Lifecycle status for waste reports.';
COMMENT ON TYPE pickup_status IS 'Lifecycle status for pickup requests and assignments.';
COMMENT ON TYPE payment_status IS 'Admin validation status for pickup payment proof.';
COMMENT ON TYPE reward_reason IS 'Reason a reward was granted to a user.';

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at() IS 'Trigger function to automatically update updated_at timestamps.';
