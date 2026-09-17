-- 011_extend_pickups_and_reports.sql
-- Add richer fields used by the mobile app and expand waste types.

-- Pickup requests: allow hazardous and store optional metadata.
ALTER TABLE pickup_requests
  DROP CONSTRAINT IF EXISTS pickup_requests_waste_type_check;

ALTER TABLE pickup_requests
  ADD CONSTRAINT pickup_requests_waste_type_check CHECK (
    lower(waste_type) IN ('household', 'plastic', 'organic', 'electronic', 'hazardous')
  );

ALTER TABLE pickup_requests
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Waste reports: store the report type + a user-provided location label.
ALTER TABLE waste_reports
  ADD COLUMN IF NOT EXISTS report_type varchar(64),
  ADD COLUMN IF NOT EXISTS location_text text;

