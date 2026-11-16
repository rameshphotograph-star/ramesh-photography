import test from "node:test";
import assert from "node:assert/strict";
import { buildAssistantPrompt, normalizeAssistantInput } from "../functions/_lib/claude.js";

test("assistant accepts only supported tasks and bounded user input", () => {
  const input = normalizeAssistantInput({
    task: "instagram_caption",
    language: "English + Telugu",
    tone: "Modern and creative",
    brief: "Create a wedding booking story for November dates.",
    context: "Bookings via WhatsApp."
  });
  assert.equal(input.language, "English + Telugu");
  assert.throws(() => normalizeAssistantInput({ task: "unknown", brief: "hello" }));
  assert.throws(() => normalizeAssistantInput({ task: "instagram_caption", brief: "x".repeat(1801) }));
  assert.throws(() => normalizeAssistantInput({ task: "instagram_caption", brief: "ok", context: "x".repeat(801) }));
});

test("prompt contains the studio context and forbids invented business facts", () => {
  const input = normalizeAssistantInput({
    task: "quotation_copy",
    brief: "Prepare wording for photography-only coverage."
  });
  const prompt = buildAssistantPrompt(input);
  assert.match(prompt, /Ramesh Photography/);
  assert.match(prompt, /Do not invent testimonials, client names, prices/);
  assert.match(prompt, /quotation wording/i);
});
