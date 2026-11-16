import { sha256Hex } from "./crypto.js";
import { ensureSupportTables } from "./schema.js";
import { githubOAuthStarted, ALLOWED_GITHUB_USER_ID } from "./github-oauth.js";
export const COOKIE_NAME = "rp_admin_session";
export function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const item = part.trim(), index = item.indexOf("=");
    if (index > 0 && item.slice(0, index) === name) {
      try {
        const value = decodeURIComponent(item.slice(index + 1));
        return value.length <= 128 ? value : "";
      } catch {
        return "";
      }
    }
  }
  return "";
}
export function sessionCookie(token) {
  return COOKIE_NAME + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200";
}
export function clearSessionCookie() { return COOKIE_NAME + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"; }
export async function authenticateAdmin(request, env) {
  if (!env || !env.DB) return null;
  await ensureSupportTables(env.DB);
  const token = cookieValue(request, COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = githubOAuthStarted(env)
    ? await env.DB.prepare(
        "SELECT a.id, a.name, a.email FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP AND a.is_active=1 AND a.github_user_id=? LIMIT 1"
      ).bind(tokenHash, ALLOWED_GITHUB_USER_ID).first()
    : await env.DB.prepare(
        "SELECT a.id, a.name, a.email FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP AND a.is_active=1 LIMIT 1"
      ).bind(tokenHash).first();
  return row || null;
}
export function clientIp(request) { return request.headers.get("CF-Connecting-IP") || "unknown"; }
