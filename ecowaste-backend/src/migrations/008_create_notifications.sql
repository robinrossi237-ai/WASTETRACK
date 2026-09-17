-- 008_create_notifications.sql
-- User notifications (status updates, rewards, announcements).

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_message_not_blank CHECK (length(trim(message)) > 0)
);

COMMENT ON TABLE notifications IS 'Notifications delivered to users.';

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_is_read ON notifications (is_read);
CREATE INDEX idx_notifications_user_id_is_read ON notifications (user_id, is_read);

