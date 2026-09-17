-- 030_unique_active_collector_assignment.sql
-- Prevent multiple active collector assignments for a single pickup.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY pickup_request_id
      ORDER BY assigned_at DESC, id DESC
    ) AS rn
  FROM collector_assignments
  WHERE status IN ('assigned', 'in_progress')
)
UPDATE collector_assignments ca
SET
  status = 'cancelled',
  issue_reason = COALESCE(ca.issue_reason, 'superseded_by_new_assignment'),
  issue_note = COALESCE(
    ca.issue_note,
    'Cancelled automatically while enforcing one active assignment per pickup.'
  )
FROM ranked
WHERE ca.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collector_assignments_unique_active_pickup
  ON collector_assignments (pickup_request_id)
  WHERE status IN ('assigned', 'in_progress');
