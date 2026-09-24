-- 039_feedback_visibility.sql
-- Allow admins to hide feedback from the public testimonials wall.

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN feedback.is_visible IS 'Whether this feedback may appear on the public site testimonials.';

CREATE INDEX IF NOT EXISTS idx_feedback_is_visible_created
  ON feedback (is_visible, created_at DESC);
