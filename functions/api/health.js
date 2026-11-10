const REQUIRED_COLUMNS = {
  admins: ["id", "name", "email", "password_hash", "is_active"],
  events: ["id", "admin_id", "event_name", "event_type", "event_date", "venue", "event_code", "status", "created_at"],
  albums: ["id", "event_id", "album_name", "created_at"],
  photos: ["id", "event_id", "album_id", "object_key", "file_name", "content_type", "file_size", "uploaded_at"],
  admin_sessions: ["id", "admin_id", "token_hash", "expires_at"],
  login_attempts: ["id", "ip_hash", "attempted_at", "success"],
  photo_delivery_meta: ["photo_id", "secure_url", "resource_type", "width", "height", "format", "duration"]
};

export async function onRequestGet({ env }) {
  const result = {
    status: "ok",
    database: false,
    schemaReady: false,
    cloudinaryConfigured: false,
    adminBootstrapConfigured: false,
    previewFolderIsolated: false,
    missingTables: [],
    missingColumns: {}
  };

  try {
    const tableRows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tables = new Set((tableRows.results || []).map(row => row.name));
    result.missingTables = Object.keys(REQUIRED_COLUMNS).filter(name => !tables.has(name));

    for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
      if (!tables.has(table)) continue;
      const columns = await env.DB.prepare("PRAGMA table_info(" + table + ")").all();
      const actual = new Set((columns.results || []).map(column => column.name));
      const missing = required.filter(column => !actual.has(column));
      if (missing.length) result.missingColumns[table] = missing;
    }

    result.database = true;
    result.schemaReady = result.missingTables.length === 0 && Object.keys(result.missingColumns).length === 0;
  } catch {
    result.database = false;
  }

  result.cloudinaryConfigured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  result.adminBootstrapConfigured = Boolean(env.ADMIN_BOOTSTRAP_KEY);
  result.previewFolderIsolated = String(env.CLOUDINARY_FOLDER_PREFIX || "").startsWith("ramesh-photography-preview");
  return new Response(JSON.stringify(result), {
    status: result.database && result.schemaReady ? 200 : 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
