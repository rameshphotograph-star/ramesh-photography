import { json, error, readJson, text, validEmail, requireDb } from "../../_lib/http.js";
import { hashPassword, constantTimeTextEqual } from "../../_lib/crypto.js";

async function ensureSupportTables(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_hash TEXT NOT NULL, attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, success INTEGER NOT NULL DEFAULT 0)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_hash, attempted_at)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS photo_delivery_meta (photo_id INTEGER PRIMARY KEY, secure_url TEXT NOT NULL, resource_type TEXT NOT NULL DEFAULT 'image', width INTEGER, height INTEGER, format TEXT, duration REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(photo_id) REFERENCES photos(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_photo_delivery_meta_type ON photo_delivery_meta(resource_type)").run();
}

export async function onRequestPost({ request, env }) {
  try {
    const db = requireDb(env), input = await readJson(request);
    const bootstrapKey = text(input.bootstrapKey, 300), name = text(input.name, 100);
    const email = text(input.email, 190).toLowerCase(), password = typeof input.password === "string" ? input.password : "";
    if (!env.ADMIN_BOOTSTRAP_KEY) return error("ADMIN_BOOTSTRAP_KEY is not configured in Cloudflare Pages secrets.", 503);
    if (!constantTimeTextEqual(bootstrapKey, env.ADMIN_BOOTSTRAP_KEY)) return error("Invalid bootstrap key.", 403);

    // A valid bootstrap key may safely ensure the two additive support tables,
    // even when an admin account was created earlier.
    await ensureSupportTables(db);

    const count = await db.prepare("SELECT COUNT(*) AS total FROM admins").first();
    if (Number(count?.total || 0) > 0) return error("Initial admin setup is already locked. Use admin login.", 409);
    if (!name || !validEmail(email) || password.length < 12) return error("Enter a name, valid email and password with at least 12 characters.");
    const passwordHash = await hashPassword(password);
    const result = await db.prepare("INSERT INTO admins (name,email,password_hash,is_active) SELECT ?,?,?,1 WHERE NOT EXISTS (SELECT 1 FROM admins)")
      .bind(name, email, passwordHash).run();
    if (!result.meta || result.meta.changes !== 1) return error("An admin account already exists. Please sign in.", 409);
    return json({ success: true, message: "Admin account created. Sign in using your new credentials." }, 201);
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) return error("That email is already registered.", 409);
    return error(err.message || "Bootstrap failed.", 500);
  }
}
