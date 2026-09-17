-- 013_pickup_geo.sql
-- Add latitude/longitude to pickup requests for mapping.

ALTER TABLE pickup_requests
  ADD COLUMN IF NOT EXISTS latitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9, 6);

CREATE INDEX IF NOT EXISTS idx_pickup_requests_lat_lng ON pickup_requests (latitude, longitude);

COMMENT ON COLUMN pickup_requests.latitude IS 'Optional latitude for pickup location';
COMMENT ON COLUMN pickup_requests.longitude IS 'Optional longitude for pickup location';
