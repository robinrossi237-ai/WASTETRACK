-- 036_add_waste_report_priority.sql
-- Add priority flagging for waste reports (emergency / high / normal).

ALTER TABLE waste_reports
  ADD COLUMN IF NOT EXISTS priority varchar(16) NOT NULL DEFAULT 'normal';

-- Ensure only allowed values are stored.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'waste_reports_priority_check'
      AND conrelid = 'waste_reports'::regclass
  ) THEN
    ALTER TABLE waste_reports
      ADD CONSTRAINT waste_reports_priority_check
      CHECK (priority IN ('normal', 'high', 'emergency'));
  END IF;
END $$;
