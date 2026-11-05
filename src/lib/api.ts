import { createClient } from "@/lib/supabase/client";

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Calls a Supabase Edge Function as the signed-in user. */
export async function callFunction<T>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const parsed = ctx ? await ctx.json() : null;
      if (parsed?.error) message = parsed.error;
    } catch {
      /* keep original message */
    }
    if (/Failed to send a request|FunctionsFetchError/i.test(message)) {
      message = "سرور ایجنت در دسترس نیست. احتمالاً Edge Functionها هنوز deploy نشده‌اند.";
    }
    throw new Error(message);
  }
  return data as T;
}

export type AgentReply = { reply: string; actions: { tool: string; ok: boolean }[] };

export const askAgent = (message: string) => callFunction<AgentReply>("agent", { message });
