-- 031_create_push_tokens.sql
-- Device push tokens for Expo push notifications.

CREATE TABLE push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token varchar(255) NOT NULL,
  platform varchar(16) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_token_unique UNIQUE (token),
  CONSTRAINT push_tokens_platform_valid CHECK (platform IN ('ios', 'android', 'web'))
);

COMMENT ON TABLE push_tokens IS 'Registered device push tokens for Expo push delivery.';

CREATE INDEX idx_push_tokens_user_id ON push_tokens (user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens (is_active);
CREATE INDEX idx_push_tokens_user_active ON push_tokens (user_id, is_active);

CREATE TRIGGER trg_push_tokens_set_updated_at
BEFORE UPDATE ON push_tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
