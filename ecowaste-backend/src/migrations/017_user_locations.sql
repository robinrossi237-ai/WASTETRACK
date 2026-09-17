-- 017_user_locations.sql
-- Store latest known locations for live tracking.

CREATE TABLE IF NOT EXISTS user_locations (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  latitude numeric(9, 6) NOT NULL,
  longitude numeric(9, 6) NOT NULL,
  accuracy numeric(10, 2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_locations_lat_range CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT user_locations_lng_range CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE INDEX IF NOT EXISTS idx_user_locations_role ON user_locations (role);
CREATE INDEX IF NOT EXISTS idx_user_locations_updated_at ON user_locations (updated_at DESC);
