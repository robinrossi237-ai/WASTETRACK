-- 025_add_report_cancelled_status.sql
-- Allow residents to cancel reports.

DO $$
BEGIN
  ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
