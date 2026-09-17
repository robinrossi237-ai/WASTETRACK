-- 006_create_collector_assignments.sql
-- Assignment of approved pickup requests to collectors.

CREATE TABLE collector_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pickup_request_id uuid NOT NULL REFERENCES pickup_requests(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status pickup_status NOT NULL,
  CONSTRAINT collector_assignments_unique_collector_pickup UNIQUE (collector_id, pickup_request_id),
  CONSTRAINT collector_assignments_status_check CHECK (
    status IN ('assigned', 'in_progress', 'completed', 'cancelled')
  ),
  CONSTRAINT collector_assignments_completed_at_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

COMMENT ON TABLE collector_assignments IS 'Collector task assignments for pickup requests.';
COMMENT ON COLUMN collector_assignments.status IS 'Assignment status (restricted subset of pickup_status).';

CREATE INDEX idx_collector_assignments_collector_id ON collector_assignments (collector_id);
CREATE INDEX idx_collector_assignments_pickup_request_id ON collector_assignments (pickup_request_id);
CREATE INDEX idx_collector_assignments_status ON collector_assignments (status);

