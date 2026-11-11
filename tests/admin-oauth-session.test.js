import test from "node:test";
import assert from "node:assert/strict";
import { authenticateAdmin, cookieValue, COOKIE_NAME } from "../functions/_lib/auth.js";

function mockDb(row) {
  let sql = "";
  let bindings = [];
  return {
    prepare(query) {
      sql = query;
      return {
        bind(...values) {
          bindings = values;
          return { first: async () => row };
        }
      };
    },
    inspect() { return { sql, bindings }; }
  };
}

test("OAuth-enabled sessions must belong to the allowlisted GitHub-linked admin", async () => {
  const db = mockDb({ id: 7, name: "Ramesh", email: "ramesh@example.com" });
  const request = new Request("https://photos.example.test/admin.html", {
    headers: { Cookie: COOKIE_NAME + "=session-token" }
  });
  const admin = await authenticateAdmin(request, {
    DB: db,
    GITHUB_OAUTH_CLIENT_ID: "client",
    GITHUB_OAUTH_CLIENT_SECRET: "secret",
    GITHUB_OAUTH_REDIRECT_URI: "https://photos.example.test/api/admin/oauth/github/callback"
  });
  assert.equal(admin.id, 7);
  assert.match(db.inspect().sql, /a\.github_user_id=\?/);
  assert.equal(db.inspect().bindings[1], "340888996");
});

test("legacy preview sessions remain usable only when GitHub OAuth is not configured", async () => {
  const db = mockDb({ id: 7, name: "Ramesh", email: "ramesh@example.com" });
  const request = new Request("https://photos.example.test/admin.html", {
    headers: { Cookie: COOKIE_NAME + "=session-token" }
  });
  const admin = await authenticateAdmin(request, { DB: db });
  assert.equal(admin.id, 7);
  assert.doesNotMatch(db.inspect().sql, /github_user_id/);
});

test("malformed and oversized session cookies fail closed", () => {
  const malformed = new Request("https://photos.example.test/", {
    headers: { Cookie: COOKIE_NAME + "=%E0%A4%A" }
  });
  const oversized = new Request("https://photos.example.test/", {
    headers: { Cookie: COOKIE_NAME + "=" + "a".repeat(129) }
  });
  assert.equal(cookieValue(malformed, COOKIE_NAME), "");
  assert.equal(cookieValue(oversized, COOKIE_NAME), "");
});
