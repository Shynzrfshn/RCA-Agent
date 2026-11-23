export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
type Provider = { name: string; url: string; key: string; model: string; tools: boolean; vision: boolean; json: boolean };
const cooldown = new Map<string, number>();
const env = (name: string) => Deno.env.get(name)?.trim() || "";

function providers(): Provider[] {
  const all: Provider[] = [
    { name: "openrouter", url: env("LLM_BASE_URL") || "https://openrouter.ai/api/v1", key: env("LLM_API_KEY"), model: env("LLM_MODEL") || "nvidia/nemotron-3.5-super-vl:free", tools: true, vision: true, json: true },
    { name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai", key: env("GEMINI_API_KEY"), model: env("GEMINI_MODEL") || "gemini-2.5-flash-lite", tools: true, vision: true, json: true },
    { name: "groq", url: "https://api.groq.com/openai/v1", key: env("GROQ_API_KEY"), model: env("GROQ_MODEL") || "openai/gpt-oss-20b", tools: true, vision: false, json: true },
    { name: "cloudflare", url: `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/ai/v1`, key: env("CLOUDFLARE_API_KEY"), model: env("CLOUDFLARE_MODEL") || "@cf/meta/llama-3.1-8b-instruct", tools: false, vision: false, json: false },
  ];
  const order = (env("LLM_PROVIDER_ORDER") || "openrouter,gemini,groq,cloudflare").split(",").map((s) => s.trim());
  return order.flatMap((name) => all.filter((p) => p.name === name && p.key && (name !== "cloudflare" || env("CLOUDFLARE_ACCOUNT_ID"))));
}

export class LlmError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; this.name = "LlmError"; }
}

export async function chat(opts: { messages: ChatMessage[]; tools?: ToolDef[]; json?: boolean; maxTokens?: number; temperature?: number }): Promise<{ message: Extract<ChatMessage, { role: "assistant" }>; finishReason: string }> {
  const vision = opts.messages.some((m) => m.role === "user" && Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
  const candidates = providers().filter((p) => (!opts.tools?.length || p.tools) && (!vision || p.vision) && (!opts.json || p.json));
  if (!candidates.length) throw new LlmError(503, "No configured provider supports this request");
  let last = new LlmError(503, "No LLM provider available");
  for (const p of candidates) {
    if ((cooldown.get(p.name) || 0) > Date.now()) continue;
    const body: Record<string, unknown> = { model: p.model, messages: opts.messages, max_tokens: opts.maxTokens ?? 4000, temperature: opts.temperature ?? 0.3 };
    if (p.name === "openrouter") {
      const fallbacks = (env("LLM_FALLBACK_MODELS") || "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free").split(",").map((s) => s.trim()).filter((s) => s && s !== p.model);
      if (fallbacks.length) body.models = [p.model, ...fallbacks];
    }
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
      body.tool_choice = "auto";
    }
    if (opts.json) body.response_format = { type: "json_object" };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${p.url.replace(/\/$/, "")}/chat/completions`, {
          method: "POST", signal: AbortSignal.timeout(22000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}`, ...(p.name === "openrouter" ? { "HTTP-Referer": env("APP_URL") || "https://github.com", "X-Title": "RCA Agent" } : {}) },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          const choice = data.choices?.[0];
          if (!choice?.message || (opts.tools?.length && !choice.message.content && !choice.message.tool_calls?.length)) throw new LlmError(502, "Empty LLM response");
          return { message: { role: "assistant", content: choice.message.content ?? null, tool_calls: choice.message.tool_calls?.length ? choice.message.tool_calls : undefined }, finishReason: choice.finish_reason ?? "stop" };
        }
        const detail = (await res.text()).slice(0, 200);
        last = new LlmError(res.status, `${p.name} ${res.status}: ${detail}`);
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after"));
          cooldown.set(p.name, Date.now() + (Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 3600) * 1000 : 60000));
        }
        if ([400, 401, 403, 404, 429].includes(res.status)) break;
      } catch (err) {
        last = err instanceof LlmError ? err : new LlmError(503, `${p.name} unavailable: ${(err as Error).name}`);
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
    }
    cooldown.set(p.name, Math.max(cooldown.get(p.name) || 0, Date.now() + (last.status === 429 ? 60000 : 10000)));
  }
  throw last;
}

export function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try { return JSON.parse(text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim()) as T; }
  catch { return null; }
}

