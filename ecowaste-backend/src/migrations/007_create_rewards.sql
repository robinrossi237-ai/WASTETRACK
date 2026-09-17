-- 007_create_rewards.sql
-- Rewards ledger: points granted to users for community actions.

CREATE TABLE rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason reward_reason NOT NULL,
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rewards_points_positive CHECK (points > 0)
);

COMMENT ON TABLE rewards IS 'Points earned by users for reporting/participation/bonuses.';
COMMENT ON COLUMN rewards.related_entity_id IS 'Optional reference to a related record (e.g., waste_report or pickup_request id).';

CREATE INDEX idx_rewards_user_id ON rewards (user_id);
CREATE INDEX idx_rewards_reason ON rewards (reason);

