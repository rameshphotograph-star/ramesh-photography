import { randomToken } from "./crypto.js";

export const ALLOWED_GITHUB_USER_ID = "340888996";
export const GITHUB_STATE_COOKIE = "rp_github_oauth_state";
export const GITHUB_VERIFIER_COOKIE = "rp_github_oauth_verifier";
export const GITHUB_CALLBACK_PATH = "/api/admin/oauth/github/callback";

export function githubOAuthStarted(env) {
  return Boolean(env?.GITHUB_OAUTH_CLIENT_ID || env?.GITHUB_OAUTH_CLIENT_SECRET || env?.GITHUB_OAUTH_REDIRECT_URI);
}

export function githubOAuthConfigured(env) {
  return Boolean(env?.GITHUB_OAUTH_CLIENT_ID && env?.GITHUB_OAUTH_CLIENT_SECRET && env?.GITHUB_OAUTH_REDIRECT_URI);
}

export function validateGithubRedirectUri(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.pathname === GITHUB_CALLBACK_PATH && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createPkcePair() {
  const verifier = randomToken(48);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function createGithubAuthorizeUrl({ clientId, redirectUri, state, challenge }) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("allow_signup", "false");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function isAllowedGithubIdentity(profile) {
  return profile && String(profile.id) === ALLOWED_GITHUB_USER_ID && typeof profile.login === "string";
}

export function primaryVerifiedGithubEmail(emails) {
  if (!Array.isArray(emails)) return "";
  const primary = emails.find(item => item && item.primary === true && item.verified === true && typeof item.email === "string");
  return primary ? primary.email.trim().toLowerCase() : "";
}

export function oauthCookie(name, value, maxAge = 600) {
  return name + "=" + encodeURIComponent(value) + "; Path=/api/admin/oauth/github; Max-Age=" + maxAge + "; HttpOnly; Secure; SameSite=Lax";
}

export function clearOauthCookie(name) {
  return name + "=; Path=/api/admin/oauth/github; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}
