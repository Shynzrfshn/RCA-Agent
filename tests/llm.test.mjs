import { test } from "node:test";
import assert from "node:assert/strict";

test("falls back to a second provider after a rate limit", async () => {
  const values = new Map([
    ["LLM_API_KEY", "router-test"],
    ["GEMINI_API_KEY", "gemini-test"],
    ["LLM_PROVIDER_ORDER", "openrouter,gemini"],
  ]);
  globalThis.Deno = { env: { get: (key) => values.get(key) } };
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return calls.length === 1
      ? new Response("limited", { status: 429, headers: { "retry-after": "60" } })
      : Response.json({ choices: [{ message: { content: "سلام" }, finish_reason: "stop" }] });
  };
  const { chat } = await import("../supabase/functions/_shared/llm.ts");
  const result = await chat({ messages: [{ role: "user", content: "سلام" }] });
  assert.equal(result.message.content, "سلام");
  assert.match(calls[0], /openrouter/);
  assert.match(calls[1], /generativelanguage/);
});

