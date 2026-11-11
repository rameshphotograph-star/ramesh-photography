import test from "node:test";
import assert from "node:assert/strict";
import { authenticateAdmin, cookieValue, COOKIE_NAME } from "../functions/_lib/auth.js";

function mockDb(adminRow) {
  let finalQuery = "";
  let finalBindings = [];
  return {
    prepare(query) {
      return {
        bind(...values) {
          finalQuery = query;
          finalBindings = values;
          return {
            first: async () => adminRow,
            all: async () => ({ results: [] }),
            run: async () => ({ success: true })
          };
        },
        first: async () => adminRow,
        all: async () => {
          if (query.includes("sqlite_master")) {
            return { results: [{ name: "login_attempts" }, { name: "photo_delivery_meta" }] };
          }
          if (query.includes("PRAGMA table_info(login_attempts)")) {
            return { results: ["id", "ip_hash", "email_hash", "attempted_at", "success"].map(name => ({ name })) };
          }
          if (query.includes("PRAGMA table_info(admins)")) {
            return { results: ["id", "name", "email", "password_hash", "is_active", "github_user_id"].map(name => ({ name })) };
          }
          return { results: [] };
        },
        run: async () => ({ success: true })
      };
    },
    inspect() { return { sql: finalQuery, bindings: finalBindings }; }
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

test("sessions are still GitHub-bound when OAuth configuration is only partially present", async () => {
  const db = mockDb({ id: 7, name: "Ramesh", email: "ramesh@example.com" });
  const request = new Request("https://photos.example.test/admin.html", {
    headers: { Cookie: COOKIE_NAME + "=session-token" }
  });
  const admin = await authenticateAdmin(request, {
    DB: db,
    GITHUB_OAUTH_CLIENT_ID: "client-id"
  });
  assert.equal(admin.id, 7);
  assert.match(db.inspect().sql, /a\.github_user_id=\?/);
  assert.equal(db.inspect().bindings[1], "340888996");
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
