-- 035_collector_exit_location_capture_setting.sql
-- Collector preference for saving location when signing out or leaving the app.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS collector_exit_location_capture_enabled boolean NOT NULL DEFAULT true;
