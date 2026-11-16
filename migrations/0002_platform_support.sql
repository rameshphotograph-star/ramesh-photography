-- Additive migration for the existing D1 schema. Does not drop or recreate core tables.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  success INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_hash, attempted_at);
CREATE TABLE IF NOT EXISTS photo_delivery_meta (
  photo_id INTEGER PRIMARY KEY,
  secure_url TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'image',
  width INTEGER, height INTEGER, format TEXT, duration REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(photo_id) REFERENCES photos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_photo_delivery_meta_type ON photo_delivery_meta(resource_type);
