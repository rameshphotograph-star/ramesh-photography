import { json, error } from "../../_lib/http.js";
import { githubOAuthConfigured } from "../../_lib/github-oauth.js";
export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM admins").first();
    return json({
      success: true,
      needsBootstrap: Number(row?.total || 0) === 0,
      githubOAuthConfigured: githubOAuthConfigured(env)
    });
  } catch (err) { return error(err.message || "Could not check setup status.", 500); }
}
