// POST { message: string }  -> chat with the agent (tool use)
// POST { action: "briefing", kind?: "morning" | "evening" | "weekly" } -> (re)generate a review
import { HttpError, json, serve } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { generateReview, loadProfile, runAgent, type ReviewKind } from "../_shared/agent.ts";
import { localParts } from "../_shared/time.ts";
import type { ChatMessage } from "../_shared/llm.ts";

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const { user, db } = await requireUser(req);
  const admin = adminClient();
  const body = await req.json().catch(() => ({}));

  if (body.action === "briefing") {
    const kind: ReviewKind = ["morning", "evening", "weekly"].includes(body.kind) ? body.kind : "morning";
    const content = await generateReview(db, user.id, kind);
    const { timezone } = await loadProfile(db, user.id);
    const day = localParts(timezone).date;
    await admin
      .from("briefings")
      .upsert({ user_id: user.id, day, kind, content }, { onConflict: "user_id,day,kind" });
    return json({ day, kind, content });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message && typeof body.image !== "string") throw new HttpError(400, "message_required");
  if (message.length > 8000) throw new HttpError(413, "message_too_long");
  const image = typeof body.image === "string" ? body.image : undefined;
  if (image && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    throw new HttpError(400, "bad_image");
  }
  if (image && image.length > 3_000_000) throw new HttpError(413, "image_too_large");

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

  await admin.from("agent_messages").insert({ user_id: user.id, role: "user", content: image ? `📷 ${message || "عکس"}` : message });
  const result = await runAgent({ db, admin, userId: user.id, history, message, image });
  await admin
    .from("agent_messages")
    .insert({ user_id: user.id, role: "assistant", content: result.reply });

  return json(result);
});
