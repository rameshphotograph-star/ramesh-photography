import test from "node:test";
import assert from "node:assert/strict";
import { isSameOriginRequest } from "../functions/_lib/http.js";

test("accepts same-origin POST requests", () => {
  const request = new Request("https://photos.example.test/api/admin/events", {
    method: "POST",
    headers: { Origin: "https://photos.example.test" }
  });
  assert.equal(isSameOriginRequest(request), true);
});

test("rejects cross-origin requests", () => {
  const request = new Request("https://photos.example.test/api/admin/events", {
    method: "POST",
    headers: { Origin: "https://attacker.example" }
  });
  assert.equal(isSameOriginRequest(request), false);
});

test("rejects opaque and missing origins", () => {
  const opaque = new Request("https://photos.example.test/api/admin/events", {
    method: "POST",
    headers: { Origin: "null" }
  });
  const missing = new Request("https://photos.example.test/api/admin/events", { method: "POST" });
  assert.equal(isSameOriginRequest(opaque), false);
  assert.equal(isSameOriginRequest(missing), false);
});
