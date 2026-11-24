// POST { message: string }  -> chat with the agent (tool use)
// POST { action: "briefing", kind?: "morning" | "evening" | "weekly" } -> (re)generate a review
import { HttpError, json, serve } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { generateReview, loadProfile, runAgent, runConfirmedActions, type AgentResult, type ReviewKind } from "../_shared/agent.ts";
import { localParts } from "../_shared/time.ts";
import type { ChatMessage } from "../_shared/llm.ts";

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const { user, db } = await requireUser(req);
  const admin = adminClient();
  const body = await req.json().catch(() => ({}));
  const { ai_sensitive_enabled } = await loadProfile(db, user.id);
  if (!ai_sensitive_enabled) throw new HttpError(403, "ai_sensitive_consent_required");

  const suppliedRequestId = typeof body.request_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.request_id)
    ? body.request_id : undefined;

  if (body.action === "confirm" || body.action === "cancel") {
    if (!suppliedRequestId) throw new HttpError(400, "valid_request_id_required");
    const { data: turn, error: turnError } = await admin.from("agent_turns")
      .select("status, result").eq("user_id", user.id).eq("request_id", suppliedRequestId).single();
    if (turnError || !turn) throw new HttpError(404, "agent_turn_not_found");
    if (turn.status === "completed" || turn.status === "cancelled") return json(turn.result);
    if (turn.status !== "awaiting_confirmation") throw new HttpError(409, "agent_turn_not_confirmable");

    if (body.action === "cancel") {
      const cancelled: AgentResult = { reply: "اقدام لغو شد و تغییری انجام نشد.", actions: [] };
      await admin.from("agent_turns").update({ status: "cancelled", result: cancelled, updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("request_id", suppliedRequestId).eq("status", "awaiting_confirmation");
      return json(cancelled);
    }

    const pending = Array.isArray(turn.result?.pending_actions) ? turn.result.pending_actions : [];
    if (!pending.length) throw new HttpError(409, "no_pending_actions");
    const { data: claimed } = await admin.from("agent_turns")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("request_id", suppliedRequestId).eq("status", "awaiting_confirmation")
      .select("request_id").maybeSingle();
    if (!claimed) throw new HttpError(409, "confirmation_in_progress");
    try {
      const confirmed = await runConfirmedActions({ db, admin, userId: user.id, pending });
      await admin.from("agent_turns").update({ status: "completed", result: confirmed, error_code: null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("request_id", suppliedRequestId);
      await admin.from("agent_messages").insert({ user_id: user.id, role: "assistant", content: confirmed.reply });
      return json(confirmed);
    } catch (error) {
      await admin.from("agent_turns").update({ status: "failed", error_code: "confirmed_action_failed", updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("request_id", suppliedRequestId);
      throw error;
    }
  }

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
  const requestId = suppliedRequestId ?? crypto.randomUUID();
  const { error: claimError } = await admin.from("agent_turns").insert({ user_id: user.id, request_id: requestId, status: "running" });
  if (claimError) {
    if (claimError.code !== "23505") throw claimError;
    const { data: existing } = await admin.from("agent_turns").select("status, result")
      .eq("user_id", user.id).eq("request_id", requestId).single();
    if (existing?.result && ["completed", "awaiting_confirmation", "cancelled"].includes(existing.status)) return json(existing.result);
    throw new HttpError(409, existing?.status === "failed" ? "request_failed_use_new_id" : "request_in_progress");
  }

  try {
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
  const nextStatus = result.pending_actions?.length ? "awaiting_confirmation" : "completed";
  const { error: finishError } = await admin.from("agent_turns").update({ result, status: nextStatus, updated_at: new Date().toISOString() })
    .eq("user_id", user.id).eq("request_id", requestId);
  if (finishError) throw finishError;

  return json(result);
  } catch (err) {
    await admin.from("agent_turns").update({ status: "failed", error_code: "agent_turn_failed", updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("request_id", requestId).eq("status", "running");
    throw err;
  }
});

