-- 012_analytics_and_audit.sql
-- Adds audit logging, SLA helper materialized views, and neighborhood suggestions.

-- Audit log for status changes and admin actions.
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(64) NOT NULL,
  entity_id uuid NOT NULL,
  action varchar(64) NOT NULL,
  actor_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- Ensure assignment lifecycle columns exist before SLA views.
ALTER TABLE collector_assignments
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

UPDATE collector_assignments
SET started_at = assigned_at
WHERE started_at IS NULL;

-- Helper view: pickup lifecycle timings.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pickup_sla AS
SELECT
  p.id,
  p.status,
  p.created_at,
  p.scheduled_date,
  pay.created_at AS payment_uploaded_at,
  a.assigned_at,
  a.started_at,
  a.completed_at,
  EXTRACT(EPOCH FROM (a.assigned_at - p.created_at)) / 3600 AS hours_to_assign,
  EXTRACT(EPOCH FROM (a.started_at - a.assigned_at)) / 3600 AS hours_to_start,
  EXTRACT(EPOCH FROM (a.completed_at - a.started_at)) / 3600 AS hours_to_complete
FROM pickup_requests p
LEFT JOIN payments pay ON pay.pickup_request_id = p.id
LEFT JOIN collector_assignments a ON a.pickup_request_id = p.id;

CREATE INDEX IF NOT EXISTS idx_mv_pickup_sla_status ON mv_pickup_sla (status);

-- Helper view: collector performance.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_collector_perf AS
SELECT
  a.collector_id,
  COUNT(*) FILTER (WHERE a.completed_at IS NOT NULL) AS completed_jobs,
  COUNT(*) FILTER (WHERE p.status = 'cancelled') AS cancellations,
  AVG(EXTRACT(EPOCH FROM (a.completed_at - a.started_at)) / 3600) AS avg_hours_per_job
FROM collector_assignments a
LEFT JOIN pickup_requests p ON p.id = a.pickup_request_id
GROUP BY a.collector_id;

-- Helper view: payments aging.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_payment_aging AS
SELECT
  id,
  status,
  created_at,
  EXTRACT(EPOCH FROM (now() - created_at)) / 3600 AS hours_pending
FROM payments;

CREATE INDEX IF NOT EXISTS idx_mv_payment_aging_status ON mv_payment_aging (status);

-- Neighborhood suggestions from user areas and report location text.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_neighborhoods AS
SELECT DISTINCT trim(both from lower(area)) AS name
FROM users
WHERE area IS NOT NULL AND length(trim(area)) > 0
UNION
SELECT DISTINCT trim(both from lower(location_text)) AS name
FROM waste_reports
WHERE location_text IS NOT NULL AND length(trim(location_text)) > 0;
