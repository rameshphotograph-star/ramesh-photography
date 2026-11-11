import { json, error, readJson, text, validEmail, requireDb, isSameOriginRequest } from "../../_lib/http.js";
import { verifyPassword, randomToken, sha256Hex } from "../../_lib/crypto.js";
import { sessionCookie, clientIp } from "../../_lib/auth.js";
import { ensureSupportTables } from "../../_lib/schema.js";
import { githubOAuthConfigured } from "../../_lib/github-oauth.js";

export async function onRequestPost({ request, env }) {
  if (githubOAuthConfigured(env)) return error("Password login is disabled. Use the approved GitHub sign-in.", 403);
  if (!isSameOriginRequest(request)) return error("Cross-origin request blocked.", 403);
  try {
    const db = requireDb(env), input = await readJson(request);
    const email = text(input.email, 190).toLowerCase(), password = typeof input.password === "string" ? input.password : "";
    if (!validEmail(email) || !password) return error("Enter your email and password.");
    await ensureSupportTables(db);
    const ipHash = await sha256Hex(clientIp(request));
    const emailHash = await sha256Hex(email);
    const ipAttempts = await db.prepare("SELECT COUNT(*) AS total FROM login_attempts WHERE ip_hash=? AND success=0 AND attempted_at>=datetime('now','-15 minutes')").bind(ipHash).first();
    const emailAttempts = await db.prepare("SELECT COUNT(*) AS total FROM login_attempts WHERE email_hash=? AND success=0 AND attempted_at>=datetime('now','-15 minutes')").bind(emailHash).first();
    if (Number(ipAttempts?.total || 0) >= 5 || Number(emailAttempts?.total || 0) >= 10) {
      return error("Too many failed attempts. Try again in 15 minutes.", 429);
    }
    const admin = await db.prepare("SELECT id,name,email,password_hash FROM admins WHERE lower(email)=? AND is_active=1 LIMIT 1").bind(email).first();
    if (!admin || !(await verifyPassword(password, admin.password_hash))) {
      await db.prepare("INSERT INTO login_attempts (ip_hash,email_hash,success) VALUES (?,?,0)").bind(ipHash,emailHash).run();
      return error("Invalid email or password.", 401);
    }
    await db.prepare("DELETE FROM login_attempts WHERE ip_hash=? OR email_hash=?").bind(ipHash,emailHash).run();
    const token = randomToken(32), tokenHash = await sha256Hex(token);
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    await db.prepare("DELETE FROM admin_sessions WHERE datetime(expires_at)<=CURRENT_TIMESTAMP").run();
    await db.prepare("INSERT INTO admin_sessions (admin_id,token_hash,expires_at) VALUES (?,?,?)").bind(admin.id, tokenHash, expires).run();
    return json({ success: true, admin: { id: admin.id, name: admin.name, email: admin.email } }, 200, { "set-cookie": sessionCookie(token) });
  } catch (err) { return error(err.message || "Login failed.", 500); }
}
