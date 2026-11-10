import { json, error, readJson, text, validEmail, requireDb } from "../../_lib/http.js";
import { hashPassword, constantTimeTextEqual } from "../../_lib/crypto.js";
import { ensureSupportTables } from "../../_lib/schema.js";

export async function onRequestPost({ request, env }) {
  try {
    const db = requireDb(env), input = await readJson(request);
    const bootstrapKey = text(input.bootstrapKey, 300), name = text(input.name, 100);
    const email = text(input.email, 190).toLowerCase(), password = typeof input.password === "string" ? input.password : "";
    if (!env.ADMIN_BOOTSTRAP_KEY) return error("ADMIN_BOOTSTRAP_KEY is not configured in Cloudflare Pages secrets.", 503);
    if (!constantTimeTextEqual(bootstrapKey, env.ADMIN_BOOTSTRAP_KEY)) return error("Invalid bootstrap key.", 403);

    // Safe, additive setup also repairs an existing admin installation.
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
