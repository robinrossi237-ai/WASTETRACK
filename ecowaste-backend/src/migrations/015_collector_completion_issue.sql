-- 015_collector_completion_issue.sql
-- Add completion proof and issue reporting for collector assignments.

ALTER TABLE collector_assignments
  ADD COLUMN IF NOT EXISTS completion_photo_url text,
  ADD COLUMN IF NOT EXISTS completion_note text,
  ADD COLUMN IF NOT EXISTS issue_reason text,
  ADD COLUMN IF NOT EXISTS issue_note text;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_collector_assignments_issue ON collector_assignments (issue_reason);
