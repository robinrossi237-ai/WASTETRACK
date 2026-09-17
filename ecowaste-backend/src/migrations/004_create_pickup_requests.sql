-- 004_create_pickup_requests.sql
-- Scheduled pickup requests from residents.

CREATE TABLE pickup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  waste_type varchar(64) NOT NULL,
  scheduled_date timestamptz NOT NULL,
  status pickup_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pickup_requests_waste_type_check CHECK (
    lower(waste_type) IN ('household', 'plastic', 'organic', 'electronic')
  )
);

COMMENT ON TABLE pickup_requests IS 'Pickup requests (with scheduling, payment proof, approval, and assignment lifecycle).';
COMMENT ON COLUMN pickup_requests.waste_type IS 'Household, Plastic, Organic, Electronic (validated via CHECK constraint).';

CREATE INDEX idx_pickup_requests_user_id ON pickup_requests (user_id);
CREATE INDEX idx_pickup_requests_status ON pickup_requests (status);
CREATE INDEX idx_pickup_requests_scheduled_date ON pickup_requests (scheduled_date);

CREATE TRIGGER trg_pickup_requests_set_updated_at
BEFORE UPDATE ON pickup_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

