import { authenticateAdmin } from "../../../_lib/auth.js";
import { error, isSameOriginRequest, json, readJson } from "../../../_lib/http.js";
import { buildAssistantPrompt, normalizeAssistantInput } from "../../../_lib/claude.js";

const SYSTEM_PROMPT = "You are the senior creative director and marketing strategist for Ramesh Photography. Create premium, contemporary and culturally aware work for South Indian wedding photography. Avoid tired clichés, excessive emojis, fake urgency and generic AI-sounding copy. Respect the user's supplied facts. Return polished content that can be copied directly.";

export async function onRequestPost({ request, env }) {
  if (!isSameOriginRequest(request)) return error("Cross-origin request blocked.", 403);
  const admin = await authenticateAdmin(request, env);
  if (!admin) return error("Admin sign-in required.", 401);
  if (!env.ANTHROPIC_API_KEY) return error("Claude is not connected yet. Add ANTHROPIC_API_KEY as a Cloudflare Pages secret.", 503);

  let input;
  try {
    input = normalizeAssistantInput(await readJson(request, 8192));
  } catch (err) {
    return error(err.message || "Invalid request.");
  }

  const model = typeof env.CLAUDE_MODEL === "string" && /^[a-zA-Z0-9._-]{3,100}$/.test(env.CLAUDE_MODEL)
    ? env.CLAUDE_MODEL
    : "claude-sonnet-5-5";
  const headers = {
    "authorization": "Bearer " + env.ANTHROPIC_API_KEY,
    "anthropic-version": "2026-10-21",
    "content-type": "application/json"
  };
  if (env.ANTHROPIC_WORKSPACE_ID) headers["anthropic-workspace-id"] = env.ANTHROPIC_WORKSPACE_ID;

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildAssistantPrompt(input) }]
      })
    });
  } catch {
    return error("Claude could not be reached. Check the Cloudflare connection and try again.", 502);
  }

  if (!response.ok) {
    if (response.status === 401) return error("Claude rejected the API key. Check the Cloudflare secret.", 502);
    if (response.status === 429) return error("Claude rate limit or usage limit reached. Check your Anthropic Console.", 429);
    return error("Claude could not complete this request. Check the Anthropic Console and try again.", 502);
  }

  let data;
  try { data = await response.json(); } catch { return error("Claude returned an unreadable response.", 502); }
  const output = Array.isArray(data.content)
    ? data.content.filter(block => block && block.type === "text").map(block => block.text).join("\n").trim()
    : "";
  if (!output) return error("Claude returned no text. Please try again.", 502);

  return json({
    success: true,
    text: output,
    model,
    usage: data.usage ? {
      inputTokens: Number(data.usage.input_tokens) || 0,
      outputTokens: Number(data.usage.output_tokens) || 0
    } : null
  });
}
