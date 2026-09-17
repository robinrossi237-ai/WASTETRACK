-- 002_create_users.sql
-- Users for residents, collectors, and admins.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  email varchar(320) NOT NULL,
  password_hash text NOT NULL,
  phone varchar(32),
  area varchar(128),
  role user_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0)
);

COMMENT ON TABLE users IS 'Platform users (residents, collectors, community admins).';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt password hash.';
COMMENT ON COLUMN users.area IS 'Optional community area/neighborhood label for routing and analytics.';
COMMENT ON COLUMN users.is_active IS 'Soft-disable flag; prefer disabling over deleting accounts.';

CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_area ON users (area);

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

