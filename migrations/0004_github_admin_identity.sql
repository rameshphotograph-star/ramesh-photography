-- Add a stable GitHub identity link to existing admin accounts.
-- No admin rows are rewritten; the OAuth callback links the allowlisted owner on first sign-in.
ALTER TABLE admins ADD COLUMN github_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_github_user_id ON admins(github_user_id) WHERE github_user_id IS NOT NULL;
