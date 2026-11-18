/**
 * Cloudflare Pages Functions middleware for the isolated CRM.
 * Protects /api/crm/* with Cloudflare Access JWT validation.
 * Required env: ACCESS_TEAM_DOMAIN (e.g. https://team.cloudflareaccess.com),
 * ACCESS_AUD (the CRM Access application's AUD tag), DB (CRM-only D1 binding).
 */
const enc = new TextEncoder();
const b64url = (s) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(p + "=".repeat((4 - p.length % 4) % 4));
};
function decodePart(s) { return JSON.parse(b64url(s)); }
async function verifyAccessJwt(token, env) {
  const issuer = String(env.ACCESS_TEAM_DOMAIN || "").replace(/\/$/, "");
  const aud = String(env.ACCESS_AUD || "");
  if (!issuer.startsWith("https://") || !aud) throw new Error("Access configuration missing");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const header = decodePart(parts[0]), claims = decodePart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported token");
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== issuer || !(Array.isArray(claims.aud) ? claims.aud.includes(aud) : claims.aud === aud) ||
      !claims.sub || !claims.email || claims.exp <= now || (claims.nbf && claims.nbf > now)) throw new Error("Invalid claims");
  const jwksRes = await fetch(issuer + "/cdn-cgi/access/certs", { headers: { accept: "application/json" } });
  if (!jwksRes.ok) throw new Error("Unable to verify identity");
  const jwks = await jwksRes.json();
  const jwk = (jwks.keys || []).find(k => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) throw new Error("Unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const sig = Uint8Array.from(b64url(parts[2]), c => c.charCodeAt(0));
  const data = enc.encode(parts[0] + "." + parts[1]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data)) throw new Error("Invalid signature");
  return { email: String(claims.email).toLowerCase(), subject: String(claims.sub) };
}
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/crm/")) return next();
  const origin = request.headers.get("Origin");
  if (request.method !== "GET" && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const raw = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!raw) return new Response("Authentication required", { status: 401 });
  try {
    const identity = await verifyAccessJwt(raw, env);
    const user = await env.DB.prepare(
      "SELECT id, display_name, role, is_active FROM crm_users WHERE email = ? COLLATE NOCASE LIMIT 1"
    ).bind(identity.email).first();
    if (!user || !user.is_active) return new Response("Account not enabled. Ask the owner.", { status: 403 });
    if (request.method !== "GET" && request.method !== "HEAD") {
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 256_000) return new Response("Request too large", { status: 413 });
    }
    context.data.crmUser = user;
    return next();
  } catch {
    return new Response("Access verification failed", { status: 401 });
  }
}
