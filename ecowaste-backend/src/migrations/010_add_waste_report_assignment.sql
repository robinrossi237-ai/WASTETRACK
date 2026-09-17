-- 010_add_waste_report_assignment.sql
-- Adds collector assignment fields to waste_reports for admin assignment workflow.

ALTER TABLE waste_reports
  ADD COLUMN IF NOT EXISTS assigned_collector_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waste_reports_assignment_consistency'
      AND conrelid = 'waste_reports'::regclass
  ) THEN
    ALTER TABLE waste_reports
      ADD CONSTRAINT waste_reports_assignment_consistency
      CHECK (
        (assigned_collector_id IS NULL AND assigned_at IS NULL)
        OR (assigned_collector_id IS NOT NULL AND assigned_at IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_waste_reports_assigned_collector_id
  ON waste_reports (assigned_collector_id);

COMMENT ON COLUMN waste_reports.assigned_collector_id IS 'Collector assigned to handle this report.';
COMMENT ON COLUMN waste_reports.assigned_at IS 'Timestamp when the report was assigned.';

