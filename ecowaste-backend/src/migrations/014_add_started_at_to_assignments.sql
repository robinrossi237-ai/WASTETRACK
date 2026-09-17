-- 014_add_started_at_to_assignments.sql
-- Add started_at to collector assignments for SLA calculations and refresh materialized views.

ALTER TABLE collector_assignments
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Backfill started_at with assigned_at where missing.
UPDATE collector_assignments
SET started_at = assigned_at
WHERE started_at IS NULL;

-- Refresh materialized views that rely on started_at.
REFRESH MATERIALIZED VIEW mv_pickup_sla;
REFRESH MATERIALIZED VIEW mv_collector_perf;
REFRESH MATERIALIZED VIEW mv_payment_aging;
