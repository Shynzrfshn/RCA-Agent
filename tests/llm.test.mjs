import { test } from "node:test";
import assert from "node:assert/strict";

test("falls back to a second provider after a rate limit", async () => {
  const values = new Map([
    ["LLM_API_KEY", "router-test"],
    ["GEMINI_API_KEY", "gemini-test"],
    ["LLM_PROVIDER_ORDER", "openrouter,gemini"],
    ["LLM_FREE_ONLY", "false"],
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
  values.delete("LLM_API_KEY");
  values.delete("GEMINI_API_KEY");
  values.set("GROQ_API_KEY", "groq-test");
  await assert.rejects(
    chat({ messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }] }] }),
    /No configured provider supports this request/,
  );
  assert.equal(calls.length, 2);
});

test("strict free mode never sends a paid model or metered provider", async () => {
  const values = new Map([
    ["LLM_API_KEY", "router-test"],
    ["GEMINI_API_KEY", "gemini-test"],
    ["LLM_PROVIDER_ORDER", "gemini,openrouter"],
    ["LLM_MODEL", "paid/model"],
    ["LLM_FALLBACK_MODELS", "paid/other,openrouter/free"],
  ]);
  globalThis.Deno = { env: { get: (key) => values.get(key) } };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json({ choices: [{ message: { content: "آماده" }, finish_reason: "stop" }] });
  };
  const { chat } = await import("../supabase/functions/_shared/llm.ts?strict-free");
  await chat({ messages: [{ role: "user", content: "سلام" }] });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /openrouter/);
  assert.match(calls[0].body.model, /:free$/);
  assert.deepEqual(calls[0].body.models, [calls[0].body.model, "openrouter/free"]);
});
