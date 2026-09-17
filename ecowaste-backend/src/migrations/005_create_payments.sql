-- 005_create_payments.sql
-- Payment proof for pickup requests with admin validation.

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_request_id uuid NOT NULL REFERENCES pickup_requests(id) ON DELETE CASCADE,
  screenshot_url text NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  approved_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_screenshot_url_not_blank CHECK (length(trim(screenshot_url)) > 0),
  CONSTRAINT payments_approval_consistency CHECK (
    (status = 'pending' AND approved_by_admin_id IS NULL AND approved_at IS NULL)
    OR (status IN ('approved', 'rejected') AND approved_by_admin_id IS NOT NULL AND approved_at IS NOT NULL)
  )
);

COMMENT ON TABLE payments IS 'Payment proof uploads for pickup requests, validated by admins.';
COMMENT ON COLUMN payments.screenshot_url IS 'URL to payment proof (screenshot or receipt).';

CREATE INDEX idx_payments_pickup_request_id ON payments (pickup_request_id);
CREATE INDEX idx_payments_status ON payments (status);

