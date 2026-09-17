-- 009_create_education_content.sql
-- Simple CMS for educational content published by admins.

CREATE TABLE education_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  body text NOT NULL,
  media_url text,
  created_by_admin_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT education_content_title_not_blank CHECK (length(trim(title)) > 0)
);

COMMENT ON TABLE education_content IS 'Educational content posts managed by admins.';

CREATE INDEX idx_education_content_created_by_admin_id ON education_content (created_by_admin_id);
CREATE INDEX idx_education_content_title ON education_content (title);

CREATE TRIGGER trg_education_content_set_updated_at
BEFORE UPDATE ON education_content
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

