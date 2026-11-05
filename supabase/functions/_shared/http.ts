export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS"
    ? new Response("ok", { headers: corsHeaders })
    : null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps a handler with CORS preflight and uniform error responses. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    const pre = preflight(req);
    if (pre) return pre;
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      if ((err as Error).name === "LlmError" || /^LLM \d+/.test((err as Error).message)) {
        const status = (err as { status?: number }).status;
        console.error(err);
        return json(
          {
            error:
              status === 429
                ? "سقف استفاده‌ی رایگان مدل پر شده؛ چند دقیقه دیگه دوباره امتحان کن."
                : "مدل هوش مصنوعی در دسترس نیست. کلید یا اسم مدل رو چک کن.",
          },
          502,
        );
      }
      console.error(err);
      return json({ error: "internal_error" }, 500);
    }
  });
}

export function isCron(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET");
  return !!secret && req.headers.get("x-cron-secret") === secret;
}
