// POST { message: string }  -> chat with the agent (tool use)
// POST { action: "briefing" } -> (re)generate today's briefing
import { HttpError, json, serve } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { generateBriefing, loadProfile, runAgent } from "../_shared/agent.ts";
import { localParts } from "../_shared/time.ts";
import type { ChatMessage } from "../_shared/llm.ts";

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const { user, db } = await requireUser(req);
  const admin = adminClient();
  const body = await req.json().catch(() => ({}));

  if (body.action === "briefing") {
    const content = await generateBriefing(db, user.id);
    const { timezone } = await loadProfile(db, user.id);
    const day = localParts(timezone).date;
    await admin
      .from("briefings")
      .upsert({ user_id: user.id, day, content }, { onConflict: "user_id,day" });
    return json({ day, content });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) throw new HttpError(400, "message_required");
  if (message.length > 8000) throw new HttpError(413, "message_too_long");

  const { data: past } = await admin
    .from("agent_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const history: ChatMessage[] = (past ?? [])
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  while (history.length && history[0].role !== "user") history.shift();

  await admin.from("agent_messages").insert({ user_id: user.id, role: "user", content: message });
  const result = await runAgent({ db, admin, userId: user.id, history, message });
  await admin
    .from("agent_messages")
    .insert({ user_id: user.id, role: "assistant", content: result.reply });

  return json(result);
});
