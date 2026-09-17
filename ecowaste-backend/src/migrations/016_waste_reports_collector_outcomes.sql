-- 016_waste_reports_collector_outcomes.sql
-- Adds collector workflow fields for waste report cleanup + issue handling.

ALTER TABLE waste_reports
  ADD COLUMN IF NOT EXISTS cleaned_by_collector_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cleaned_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleaned_photo_url text,
  ADD COLUMN IF NOT EXISTS cleaned_note text,
  ADD COLUMN IF NOT EXISTS collector_issue_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collector_issue_at timestamptz,
  ADD COLUMN IF NOT EXISTS collector_issue_reason text,
  ADD COLUMN IF NOT EXISTS collector_issue_note text;

-- Backfill cleaned fields for any existing cleaned reports.
UPDATE waste_reports
SET cleaned_at = updated_at
WHERE status = 'cleaned' AND cleaned_at IS NULL;

UPDATE waste_reports
SET cleaned_by_collector_id = assigned_collector_id
WHERE status IN ('cleaned', 'approved', 'rejected')
  AND cleaned_by_collector_id IS NULL
  AND assigned_collector_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waste_reports_cleaned_by_collector_id
  ON waste_reports (cleaned_by_collector_id);

CREATE INDEX IF NOT EXISTS idx_waste_reports_collector_issue_by_id
  ON waste_reports (collector_issue_by_id);

