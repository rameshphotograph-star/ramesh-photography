import { json, error } from "../../../../_lib/http.js";
import { randomToken } from "../../../../_lib/crypto.js";
import {
  GITHUB_STATE_COOKIE,
  GITHUB_VERIFIER_COOKIE,
  createPkcePair,
  createGithubAuthorizeUrl,
  githubOAuthConfigured,
  oauthCookie,
  validateGithubRedirectUri
} from "../../../../_lib/github-oauth.js";

export async function onRequestGet({ env }) {
  if (!githubOAuthConfigured(env)) return error("GitHub sign-in is not configured yet.", 503);
  const redirectUri = String(env.GITHUB_OAUTH_REDIRECT_URI || "");
  if (!validateGithubRedirectUri(redirectUri)) return error("GitHub OAuth callback URL is invalid.", 500);

  const state = randomToken(32);
  const { verifier, challenge } = await createPkcePair();
  const location = createGithubAuthorizeUrl({
    clientId: env.GITHUB_OAUTH_CLIENT_ID,
    redirectUri,
    state,
    challenge
  });
  const headers = new Headers({ location, "cache-control": "no-store" });
  headers.append("set-cookie", oauthCookie(GITHUB_STATE_COOKIE, state));
  headers.append("set-cookie", oauthCookie(GITHUB_VERIFIER_COOKIE, verifier));
  return new Response(null, { status: 302, headers });
}
