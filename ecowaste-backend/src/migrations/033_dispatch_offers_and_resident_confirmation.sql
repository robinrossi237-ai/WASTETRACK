-- 033_dispatch_offers_and_resident_confirmation.sql
-- Add automatic collector dispatch offers + resident confirmation workflow.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS collector_auto_location_tracking boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS collector_dispatch_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(16) NOT NULL,
  entity_id uuid NOT NULL,
  collector_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL DEFAULT 'pending',
  distance_km numeric(10, 3),
  score numeric(10, 4),
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  rejection_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT collector_dispatch_offers_entity_type_check CHECK (entity_type IN ('pickup', 'report')),
  CONSTRAINT collector_dispatch_offers_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  CONSTRAINT collector_dispatch_offers_response_check CHECK (
    (status = 'pending' AND responded_at IS NULL)
    OR (status <> 'pending' AND responded_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_collector_dispatch_offers_collector_status
  ON collector_dispatch_offers (collector_id, status, offered_at DESC);

CREATE INDEX IF NOT EXISTS idx_collector_dispatch_offers_entity
  ON collector_dispatch_offers (entity_type, entity_id, offered_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collector_dispatch_offers_unique_pending
  ON collector_dispatch_offers (entity_type, entity_id, collector_id)
  WHERE status = 'pending';

ALTER TABLE collector_assignments
  ADD COLUMN IF NOT EXISTS completion_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS resident_confirmation_status varchar(16),
  ADD COLUMN IF NOT EXISTS resident_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS resident_rejection_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collector_assignments_resident_confirmation_status_check'
  ) THEN
    ALTER TABLE collector_assignments
      ADD CONSTRAINT collector_assignments_resident_confirmation_status_check
      CHECK (
        resident_confirmation_status IS NULL
        OR resident_confirmation_status IN ('pending', 'approved', 'rejected')
      );
  END IF;
END $$;

ALTER TABLE waste_reports
  ADD COLUMN IF NOT EXISTS resident_confirmation_status varchar(16),
  ADD COLUMN IF NOT EXISTS resident_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS resident_rejection_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waste_reports_resident_confirmation_status_check'
  ) THEN
    ALTER TABLE waste_reports
      ADD CONSTRAINT waste_reports_resident_confirmation_status_check
      CHECK (
        resident_confirmation_status IS NULL
        OR resident_confirmation_status IN ('pending', 'approved', 'rejected')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_collector_assignments_resident_confirmation
  ON collector_assignments (resident_confirmation_status, completion_submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_waste_reports_resident_confirmation
  ON waste_reports (resident_confirmation_status, cleaned_at DESC);
