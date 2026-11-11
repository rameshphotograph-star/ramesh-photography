import { error } from "../../../../_lib/http.js";
import { randomToken, sha256Hex, constantTimeTextEqual } from "../../../../_lib/crypto.js";
import { cookieValue, sessionCookie } from "../../../../_lib/auth.js";
import { ensureSupportTables } from "../../../../_lib/schema.js";
import {
  ALLOWED_GITHUB_USER_ID,
  GITHUB_STATE_COOKIE,
  GITHUB_VERIFIER_COOKIE,
  clearOauthCookie,
  githubOAuthConfigured,
  isAllowedGithubIdentity,
  primaryVerifiedGithubEmail,
  validateGithubRedirectUri
} from "../../../../_lib/github-oauth.js";

function redirectWithCookies(location, status = 303) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  headers.append("set-cookie", clearOauthCookie(GITHUB_STATE_COOKIE));
  headers.append("set-cookie", clearOauthCookie(GITHUB_VERIFIER_COOKIE));
  return new Response(null, { status, headers });
}

function failure(request, message) {
  const url = new URL("/admin.html", request.url);
  url.searchParams.set("oauth_error", message);
  return redirectWithCookies(url.toString());
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      authorization: "Bearer " + token,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "Ramesh-Photography-Admin"
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error("GitHub could not verify this account.");
  return data;
}

export async function onRequestGet({ request, env }) {
  if (!githubOAuthConfigured(env)) return error("GitHub sign-in is not configured.", 503);

  const redirectUri = String(env.GITHUB_OAUTH_REDIRECT_URI || "");
  if (!validateGithubRedirectUri(redirectUri)) return error("GitHub OAuth callback URL is invalid.", 500);
  const expectedCallback = new URL(redirectUri);
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== expectedCallback.origin || requestUrl.pathname !== expectedCallback.pathname) {
    return error("GitHub OAuth callback host mismatch.", 400);
  }

  const state = requestUrl.searchParams.get("state") || "";
  const code = requestUrl.searchParams.get("code") || "";
  const savedState = cookieValue(request, GITHUB_STATE_COOKIE);
  const verifier = cookieValue(request, GITHUB_VERIFIER_COOKIE);
  if (requestUrl.searchParams.has("error")) return failure(request, "GitHub authorization was cancelled.");
  if (!code || !state || !savedState || !verifier || !constantTimeTextEqual(state, savedState)) {
    return failure(request, "GitHub sign-in could not be verified. Please try again.");
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "Ramesh-Photography-Admin"
      },
      body: new URLSearchParams({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier
      })
    });
    const tokenData = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !tokenData?.access_token) {
      return failure(request, "GitHub authorization code could not be exchanged.");
    }

    const profile = await githubJson("https://api.github.com/user", tokenData.access_token);
    if (!isAllowedGithubIdentity(profile) || String(profile.id) !== ALLOWED_GITHUB_USER_ID) {
      return failure(request, "This GitHub account is not authorized for Ramesh Photography Admin.");
    }

    const emails = await githubJson("https://api.github.com/user/emails", tokenData.access_token);
    const email = primaryVerifiedGithubEmail(emails);
    if (!email) return failure(request, "Your GitHub account needs a verified primary email address.");

    if (!env.DB) return failure(request, "Admin database is unavailable.");
    await ensureSupportTables(env.DB);

    let admin = await env.DB.prepare(
      "SELECT id,name,email FROM admins WHERE github_user_id=? AND is_active=1 LIMIT 1"
    ).bind(ALLOWED_GITHUB_USER_ID).first();

    if (!admin) {
      const rows = await env.DB.prepare(
        "SELECT id,name,email,github_user_id,is_active FROM admins ORDER BY id LIMIT 2"
      ).all();
      const admins = rows.results || [];
      if (admins.length === 0) {
        const name = String(profile.name || profile.login).trim().slice(0, 100) || "Ramesh";
        const placeholderHash = "github-oauth-only$" + randomToken(32);
        const inserted = await env.DB.prepare(
          "INSERT INTO admins (name,email,password_hash,is_active,github_user_id) VALUES (?,?,?,1,?)"
        ).bind(name, email, placeholderHash, ALLOWED_GITHUB_USER_ID).run();
        admin = { id: inserted.meta.last_row_id, name, email };
      } else if (admins.length === 1 && admins[0].is_active === 1 &&
                 (!admins[0].github_user_id || admins[0].github_user_id === ALLOWED_GITHUB_USER_ID)) {
        const candidate = admins[0];
        await env.DB.prepare(
          "UPDATE admins SET github_user_id=? WHERE id=? AND (github_user_id IS NULL OR github_user_id=?)"
        ).bind(ALLOWED_GITHUB_USER_ID, candidate.id, ALLOWED_GITHUB_USER_ID).run();
        admin = await env.DB.prepare(
          "SELECT id,name,email FROM admins WHERE id=? AND github_user_id=? AND is_active=1"
        ).bind(candidate.id, ALLOWED_GITHUB_USER_ID).first();
      } else {
        return failure(request, "Admin account cannot be linked automatically. Contact the site owner.");
      }
    }

    if (!admin) return failure(request, "Admin account is disabled or not linked.");
    const token = randomToken(32);
    const tokenHash = await sha256Hex(token);
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare("DELETE FROM admin_sessions WHERE datetime(expires_at)<=CURRENT_TIMESTAMP").run();
    await env.DB.prepare(
      "INSERT INTO admin_sessions (admin_id,token_hash,expires_at) VALUES (?,?,?)"
    ).bind(admin.id, tokenHash, expires).run();

    const destination = new URL("/admin.html?github=connected", expectedCallback.origin).toString();
    const response = redirectWithCookies(destination);
    response.headers.append("set-cookie", sessionCookie(token));
    return response;
  } catch {
    return failure(request, "GitHub sign-in failed. Please try again.");
  }
}
