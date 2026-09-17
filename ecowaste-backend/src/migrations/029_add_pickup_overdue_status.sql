-- 029_add_pickup_overdue_status.sql
-- Add overdue lifecycle state for pickup requests.

DO $$
BEGIN
  ALTER TYPE pickup_status ADD VALUE IF NOT EXISTS 'overdue';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
