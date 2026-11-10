import { json } from "../../_lib/http.js";
import { cookieValue, COOKIE_NAME, clearSessionCookie } from "../../_lib/auth.js";
import { sha256Hex } from "../../_lib/crypto.js";
export async function onRequestPost({ request, env }) {
  try {
    const token = cookieValue(request, COOKIE_NAME);
    if (token && env.DB) await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await sha256Hex(token)).run();
  } catch {}
  return json({ success: true }, 200, { "set-cookie": clearSessionCookie() });
}
