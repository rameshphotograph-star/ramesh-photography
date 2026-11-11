import { json, error } from "../../_lib/http.js";
import { authenticateAdmin } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const admin = await authenticateAdmin(request, env);
  if (!admin) return error("Not signed in.", 401);
  return json({ success: true, admin });
}
