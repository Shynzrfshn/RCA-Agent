import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return false;
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Path inside the app to open on click, e.g. "/meds/". */
  url?: string;
  tag?: string;
  /** Signed token the service worker sends back to /push-action. */
  actionToken?: string;
  actions?: { action: string; title: string }[];
};

/** Sends to every device the user subscribed. Returns how many succeeded. */
export async function pushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!configure()) {
    console.warn("VAPID keys not set; skipping push");
    return 0;
  }
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  const body = JSON.stringify({
    ...payload,
    actionUrl: payload.actionToken
      ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/push-action`
      : undefined,
  });
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 60 * 60 },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id);
      } else {
        console.error("push failed", status, err);
      }
    }
  }
  return sent;
}
