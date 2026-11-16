-- Add an account-scoped throttle key to login attempts.
-- Existing rows keep an empty email_hash and age out under the 15-minute window.
ALTER TABLE login_attempts ADD COLUMN email_hash TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email_hash, attempted_at);
