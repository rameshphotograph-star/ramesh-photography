import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_GITHUB_USER_ID,
  GITHUB_CALLBACK_PATH,
  githubOAuthConfigured,
  githubOAuthStarted,
  validateGithubRedirectUri,
  createPkcePair,
  createGithubAuthorizeUrl,
  isAllowedGithubIdentity,
  primaryVerifiedGithubEmail,
  oauthCookie,
  clearOauthCookie
} from "../functions/_lib/github-oauth.js";

test("only the explicitly allowlisted GitHub identity is accepted", () => {
  assert.equal(ALLOWED_GITHUB_USER_ID, "340888996");
  assert.equal(isAllowedGithubIdentity({ id: 340888996, login: "rameshphotograph-star" }), true);
  assert.equal(isAllowedGithubIdentity({ id: 123456, login: "someone-else" }), false);
  assert.equal(isAllowedGithubIdentity({ login: "rameshphotograph-star" }), false);
});

test("OAuth configuration requires client ID, secret and callback URL", () => {
  assert.equal(githubOAuthConfigured({ GITHUB_OAUTH_CLIENT_ID: "id", GITHUB_OAUTH_CLIENT_SECRET: "secret", GITHUB_OAUTH_REDIRECT_URI: "https://site.pages.dev" }), true);
  assert.equal(githubOAuthConfigured({ GITHUB_OAUTH_CLIENT_ID: "id", GITHUB_OAUTH_REDIRECT_URI: "https://site.pages.dev" }), false);
  assert.equal(githubOAuthStarted({ GITHUB_OAUTH_CLIENT_ID: "id" }), true);
  assert.equal(githubOAuthStarted({}), false);
});

test("callback URL must be HTTPS and use the exact callback path", () => {
  assert.equal(validateGithubRedirectUri("https://ramesh-photography.pages.dev" + GITHUB_CALLBACK_PATH), true);
  assert.equal(validateGithubRedirectUri("http://ramesh-photography.pages.dev" + GITHUB_CALLBACK_PATH), false);
  assert.equal(validateGithubRedirectUri("https://evil.example/callback"), false);
  assert.equal(validateGithubRedirectUri("https://ramesh-photography.pages.dev" + GITHUB_CALLBACK_PATH + "?next=https://evil.example"), false);
});

test("PKCE pair uses a URL-safe verifier and S256 challenge", async () => {
  const pair = await createPkcePair();
  assert.match(pair.verifier, /^[A-Za-z0-9_-]{64}$/);
  assert.match(pair.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(pair.verifier, pair.challenge);
});

test("authorization URL pins state, PKCE, minimal scopes and no signup", () => {
  const url = new URL(createGithubAuthorizeUrl({
    clientId: "client-id",
    redirectUri: "https://ramesh-photography.pages.dev" + GITHUB_CALLBACK_PATH,
    state: "unguessable-state",
    challenge: "a".repeat(43)
  }));
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/login/oauth/authorize");
  assert.equal(url.searchParams.get("state"), "unguessable-state");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "read:user user:email");
  assert.equal(url.searchParams.get("allow_signup"), "false");
});

test("only a verified primary GitHub email is selected", () => {
  assert.equal(primaryVerifiedGithubEmail([
    { email: "secondary@example.com", primary: false, verified: true },
    { email: "unverified@example.com", primary: true, verified: false },
    { email: "Ramesh@example.com", primary: true, verified: true }
  ]), "ramesh@example.com");
  assert.equal(primaryVerifiedGithubEmail([{ email: "a@example.com", primary: true, verified: false }]), "");
});

test("OAuth state cookies are Secure, HttpOnly and SameSite=Lax", () => {
  const value = oauthCookie("rp_state", "safe-state");
  assert.match(value, /HttpOnly/);
  assert.match(value, /Secure/);
  assert.match(value, /SameSite=Lax/);
  assert.match(value, /Path=\/api\/admin\/oauth\/github/);
  assert.match(clearOauthCookie("rp_state"), /Max-Age=0/);
});
