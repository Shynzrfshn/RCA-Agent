import { BASE } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function registerServiceWorker() {
  return navigator.serviceWorker.register(`${BASE}/sw.js`, {
    scope: `${BASE}/`,
    updateViaCache: "none",
  });
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registerServiceWorker();
  return reg.pushManager.getSubscription();
}

export async function enablePush(): Promise<void> {
  // Public key (safe to ship); env var overrides it.
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BIrcD2OAmPWrWMoWnyDOtwBJELgWJAHnL5_fpVpiGWjbqnY7NHegnvU_qveMdVtPG3WVNRL4nSSfP74MG93e3aM";
  if (!key) throw new Error("کلید VAPID تنظیم نشده (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("اجازه‌ی اعلان داده نشد. از تنظیمات مرورگر فعالش کن.");
  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  const json = sub.toJSON();
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: data.user!.id,
      endpoint: sub.endpoint,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function testNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("🔔 RCA Agent", {
    body: "اعلان‌ها فعال‌اند. یادآوری‌ها و داروها این شکلی میان.",
    icon: `${BASE}/icon.svg`,
    lang: "fa",
    dir: "rtl",
  });
}
