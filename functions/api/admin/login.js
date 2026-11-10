import { json, error, readJson, text, validEmail, requireDb } from "../../_lib/http.js";
import { verifyPassword, randomToken, sha256Hex } from "../../_lib/crypto.js";
import { sessionCookie, clientIp } from "../../_lib/auth.js";
export async function onRequestPost({ request, env }) {
  try {
    const db = requireDb(env), input = await readJson(request);
    const email = text(input.email, 190).toLowerCase(), password = typeof input.password === "string" ? input.password : "";
    if (!validEmail(email) || !password) return error("Enter your email and password.");
    const ipHash = await sha256Hex(clientIp(request));
    const attempts = await db.prepare("SELECT COUNT(*) AS total FROM login_attempts WHERE ip_hash=? AND success=0 AND attempted_at>=datetime('now','-15 minutes')").bind(ipHash).first();
    if (Number(attempts?.total || 0) >= 5) return error("Too many failed attempts. Try again in 15 minutes.", 429);
    const admin = await db.prepare("SELECT id,name,email,password_hash FROM admins WHERE lower(email)=? AND is_active=1 LIMIT 1").bind(email).first();
    if (!admin || !(await verifyPassword(password, admin.password_hash))) {
      await db.prepare("INSERT INTO login_attempts (ip_hash,success) VALUES (?,0)").bind(ipHash).run();
      return error("Invalid email or password.", 401);
    }
    await db.prepare("DELETE FROM login_attempts WHERE ip_hash=?").bind(ipHash).run();
    const token = randomToken(32), tokenHash = await sha256Hex(token);
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    await db.prepare("INSERT INTO admin_sessions (admin_id,token_hash,expires_at) VALUES (?,?,?)").bind(admin.id, tokenHash, expires).run();
    return json({ success: true, admin: { id: admin.id, name: admin.name, email: admin.email } }, 200, { "set-cookie": sessionCookie(token) });
  } catch (err) { return error(err.message || "Login failed.", 500); }
}
