import { json, error } from "../../_lib/http.js";
export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM admins").first();
    return json({ success: true, needsBootstrap: Number(row?.total || 0) === 0 });
  } catch (err) { return error(err.message || "Could not check setup status.", 500); }
}
