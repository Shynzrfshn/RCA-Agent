// Called by the service worker when the user taps a notification button.
// POST { token, action } — token is HMAC-signed by tick, so no session needed.
import { HttpError, json, serve } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { verify } from "../_shared/crypto.ts";

type Token = { t: "dose" | "item"; id: string; uid: string };

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const { token, action } = await req.json().catch(() => ({}));
  const payload = typeof token === "string" ? await verify<Token>(token) : null;
  if (!payload) throw new HttpError(401, "invalid_token");
  const admin = adminClient();

  if (payload.t === "dose") {
    if (action === "take" || action === "skip") {
      const { error } = await admin.rpc("_set_dose_status", {
        p_log: payload.id,
        p_status: action === "take" ? "taken" : "skipped",
        p_user: payload.uid,
      });
      if (error) throw new HttpError(400, error.message);
    } else if (action === "snooze") {
      await admin
        .from("dose_logs")
        .update({
          snooze_until: new Date(Date.now() + 15 * 60_000).toISOString(),
          notify_count: 0,
          last_notified_at: null,
        })
        .eq("id", payload.id)
        .eq("user_id", payload.uid)
        .eq("status", "pending");
    } else throw new HttpError(400, "bad_action");
  } else if (payload.t === "item") {
    if (action === "done") {
      const { error } = await admin.rpc("_complete_item", {
        p_id: payload.id,
        p_done: true,
        p_user: payload.uid,
      });
      if (error) throw new HttpError(400, error.message);
    } else if (action === "snooze") {
      await admin
        .from("items")
        .update({ due_at: new Date(Date.now() + 3600_000).toISOString(), notified_at: null })
        .eq("id", payload.id)
        .eq("user_id", payload.uid);
    } else throw new HttpError(400, "bad_action");
  }
  return json({ ok: true });
});
