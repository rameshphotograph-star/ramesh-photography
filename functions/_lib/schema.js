export async function ensureSupportTables(db) {
  const rows = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('login_attempts','photo_delivery_meta')"
  ).all();
  const existing = new Set((rows.results || []).map(row => row.name));

  if (!existing.has("login_attempts")) {
    await db.prepare(
      "CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_hash TEXT NOT NULL, email_hash TEXT NOT NULL DEFAULT '', attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, success INTEGER NOT NULL DEFAULT 0)"
    ).run();
    await db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_hash, attempted_at)"
    ).run();
  }

  const loginColumns = await db.prepare("PRAGMA table_info(login_attempts)").all();
  const loginColumnNames = new Set((loginColumns.results || []).map(column => column.name));
  if (!loginColumnNames.has("email_hash")) {
    try {
      await db.prepare("ALTER TABLE login_attempts ADD COLUMN email_hash TEXT NOT NULL DEFAULT ''").run();
    } catch (err) {
      const refreshed = await db.prepare("PRAGMA table_info(login_attempts)").all();
      const refreshedNames = new Set((refreshed.results || []).map(column => column.name));
      if (!refreshedNames.has("email_hash")) throw err;
    }
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email_hash, attempted_at)").run();

  if (!existing.has("photo_delivery_meta")) {
    await db.prepare(
      "CREATE TABLE IF NOT EXISTS photo_delivery_meta (photo_id INTEGER PRIMARY KEY, secure_url TEXT NOT NULL, resource_type TEXT NOT NULL DEFAULT 'image', width INTEGER, height INTEGER, format TEXT, duration REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(photo_id) REFERENCES photos(id) ON DELETE CASCADE)"
    ).run();
    await db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_photo_delivery_meta_type ON photo_delivery_meta(resource_type)"
    ).run();
  }
}
