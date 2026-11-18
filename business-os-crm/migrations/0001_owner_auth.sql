-- Additive Owner authentication tables. Existing CRM data is preserved.
CREATE TABLE IF NOT EXISTS crm_user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES crm_users(id) ON DELETE CASCADE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS crm_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_login_attempts_ip_time
ON crm_login_attempts(ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_expiry
ON crm_sessions(expires_at);
