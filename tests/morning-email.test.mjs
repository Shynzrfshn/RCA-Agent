import test from "node:test";
import assert from "node:assert/strict";
import { sendMorningEmail } from "../supabase/functions/_shared/morningEmail.ts";

test("morning email cannot send without server credentials", async () => {
  const previousDeno = globalThis.Deno;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.Deno = { env: { get: () => undefined } };
  globalThis.fetch = async () => { calls++; throw new Error("unexpected request"); };
  try {
    await assert.rejects(sendMorningEmail("user@example.com", "brief", "2026-11-24"), /not_configured/);
    assert.equal(calls, 0);
  } finally {
    globalThis.Deno = previousDeno;
    globalThis.fetch = previousFetch;
  }
});

test("morning email sends one private recipient with the unsubscribe setting link", async () => {
  const previousDeno = globalThis.Deno;
  const previousFetch = globalThis.fetch;
  let request;
  globalThis.Deno = { env: { get: (name) => ({ BREVO_API_KEY: "test-key", MORNING_EMAIL_FROM: "sender@example.com" })[name] } };
  globalThis.fetch = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ messageId: "accepted-id" }) }; };
  try {
    assert.equal(await sendMorningEmail("user@example.com", "کارهای امروز", "2026-11-24"), "accepted-id");
    const body = JSON.parse(request.options.body);
    assert.equal(body.to.length, 1);
    assert.equal(body.to[0].email, "user@example.com");
    assert.match(body.textContent, /settings/);
  } finally {
    globalThis.Deno = previousDeno;
    globalThis.fetch = previousFetch;
  }
});

