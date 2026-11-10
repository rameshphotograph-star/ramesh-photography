export async function onRequestGet({ env }) {
  const result = {
    status: "ok",
    database: false,
    schemaReady: false,
    cloudinaryConfigured: false,
    adminBootstrapConfigured: false,
    missingTables: []
  };
  try {
    const rows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tables = new Set((rows.results || []).map(row => row.name));
    const required = ["admins", "events", "albums", "photos", "admin_sessions", "login_attempts", "photo_delivery_meta"];
    result.missingTables = required.filter(name => !tables.has(name));
    result.database = true;
    result.schemaReady = result.missingTables.length === 0;
  } catch {
    result.database = false;
  }
  result.cloudinaryConfigured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  result.adminBootstrapConfigured = Boolean(env.ADMIN_BOOTSTRAP_KEY);
  return new Response(JSON.stringify(result), {
    status: result.database && result.schemaReady ? 200 : 503,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}
