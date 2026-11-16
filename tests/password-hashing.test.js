import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../functions/_lib/crypto.js";

test("password hashes can be created and verified with the Workers PBKDF2 ceiling", async () => {
  const password = "preview-test-password-12";
  const stored = await hashPassword(password);
  assert.match(stored, /^pbkdf2\$100000\$/);
  assert.equal(await verifyPassword(password, stored), true);
  assert.equal(await verifyPassword("not-the-password", stored), false);
});
