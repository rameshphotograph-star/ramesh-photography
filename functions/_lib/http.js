export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extraHeaders }
  });
}
export function error(message, status = 400) { return json({ success: false, error: message }, status); }
export async function readJson(request, maxBytes = 1024 * 1024) {
  const raw = await request.text();
  if (raw.length > maxBytes) throw new Error("Request is too large.");
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("Invalid JSON request."); }
}
export function text(value, max = 300) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function requireDb(env) {
  if (!env || !env.DB) throw new Error("Cloudflare D1 binding DB is missing.");
  return env.DB;
}
