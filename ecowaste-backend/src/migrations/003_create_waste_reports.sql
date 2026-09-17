-- 003_create_waste_reports.sql
-- Citizen waste reports (photo, description, geolocation) with admin verification and lifecycle state.

CREATE TABLE waste_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url text,
  description text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  status report_status NOT NULL DEFAULT 'reported',
  verified_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waste_reports_location_pair CHECK (
    (latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  ),
  CONSTRAINT waste_reports_lat_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT waste_reports_lng_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

COMMENT ON TABLE waste_reports IS 'Waste incident reports submitted by residents.';
COMMENT ON COLUMN waste_reports.verified_by_admin_id IS 'Admin who verified the report; nullable for unverified.';

CREATE INDEX idx_waste_reports_user_id ON waste_reports (user_id);
CREATE INDEX idx_waste_reports_status ON waste_reports (status);
CREATE INDEX idx_waste_reports_location ON waste_reports (latitude, longitude);

CREATE TRIGGER trg_waste_reports_set_updated_at
BEFORE UPDATE ON waste_reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

