-- 026_feedback_and_report_fixes.sql
-- Ensure report type/location fields exist and add app feedback storage.

ALTER TABLE waste_reports
  ADD COLUMN IF NOT EXISTS report_type varchar(64),
  ADD COLUMN IF NOT EXISTS location_text text;

UPDATE waste_reports
SET location_text = CONCAT(latitude, ', ', longitude)
WHERE location_text IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
