// Minimal OpenAI-compatible chat client (works with OpenRouter, DeepSeek's
// own API, and most other providers). Configure via env:
//   LLM_BASE_URL  default https://openrouter.ai/api/v1
//   LLM_API_KEY   provider key
//   LLM_MODEL     default nvidia/nemotron-3.5-super-vl:free (free, supports tools)

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const MODEL = Deno.env.get("LLM_MODEL") ?? "nvidia/nemotron-3.5-super-vl:free";
// Free-only fallbacks (all support tool calling). Override with a comma list.
const FALLBACKS = (Deno.env.get("LLM_FALLBACK_MODELS") ??
  "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s && s !== Deno.env.get("LLM_MODEL"));
const BASE_URL = (Deno.env.get("LLM_BASE_URL") ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");

export class LlmError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export async function chat(opts: {
  messages: ChatMessage[];
  tools?: ToolDef[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ message: Extract<ChatMessage, { role: "assistant" }>; finishReason: string }> {
  const key = Deno.env.get("LLM_API_KEY");
  if (!key) throw new LlmError(500, "LLM_API_KEY is not set");

  const body: Record<string, unknown> = {
    model: MODEL,
    // OpenRouter tries these in order if the main free model is busy.
    ...(FALLBACKS.length && BASE_URL.includes("openrouter.ai")
      ? { models: [MODEL, ...FALLBACKS] }
      : {}),
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 4000,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
    body.tool_choice = "auto";
  }
  if (opts.json) body.response_format = { type: "json_object" };

  // Free tiers rate-limit aggressively: retry 429/5xx with backoff.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        // OpenRouter attribution headers (ignored by other providers).
        "HTTP-Referer": Deno.env.get("APP_URL") ?? "https://github.com",
        "X-Title": "RCA Agent",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) throw new LlmError(502, data.error?.message ?? "empty LLM response");
      return {
        message: {
          role: "assistant",
          content: choice.message?.content ?? null,
          tool_calls: choice.message?.tool_calls?.length ? choice.message.tool_calls : undefined,
        },
        finishReason: choice.finish_reason ?? "stop",
      };
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 2) {
      const text = await res.text();
      let msg = text.slice(0, 300);
      try {
        msg = JSON.parse(text).error?.message ?? msg;
      } catch { /* keep raw text */ }
      throw new LlmError(res.status, `LLM ${res.status}: ${msg}`);
    }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
}

/** Strips ```json fences some models add even in JSON mode. */
export function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
