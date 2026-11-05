// Proactive, rule-based nudges. Cheap (no LLM), at most one per key per day,
// only during waking hours.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { localDayBounds } from "./time.ts";

export type Nudge = { key: string; title: string; body: string; url: string };
const fa = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
const H = 3600_000;

export async function computeNudges(
  admin: SupabaseClient,
  userId: string,
  tz: string,
): Promise<Nudge[]> {
  const now = Date.now();
  const { start: todayStart } = localDayBounds(tz);
  const yStart = new Date(todayStart.getTime() - 24 * H).toISOString();
  const out: Nudge[] = [];

  const [overdue, missed, urgent, recentDone, openCount, week, recentStreak] = await Promise.all([
    admin.from("items").select("content").eq("user_id", userId).eq("done", false)
      .lt("due_at", new Date(now - 2 * H).toISOString()).order("priority", { ascending: false }).limit(5),
    admin.from("dose_logs").select("id, medications(name)").eq("user_id", userId)
      .in("status", ["missed", "skipped"]).gte("scheduled_for", yStart)
      .lt("scheduled_for", todayStart.toISOString()),
    admin.from("emails").select("subject").eq("user_id", userId).eq("category", "urgent")
      .eq("is_read", false).lt("received_at", new Date(now - 4 * H).toISOString())
      .gte("received_at", new Date(now - 72 * H).toISOString()).limit(3),
    admin.from("items").select("id", { count: "exact", head: true }).eq("user_id", userId)
      .eq("done", true).gte("completed_at", new Date(now - 72 * H).toISOString()),
    admin.from("items").select("id", { count: "exact", head: true }).eq("user_id", userId)
      .eq("done", false).in("kind", ["task", "reminder"]),
    admin.from("dose_logs").select("status").eq("user_id", userId)
      .gte("scheduled_for", new Date(todayStart.getTime() - 7 * 24 * H).toISOString())
      .lt("scheduled_for", todayStart.toISOString()),
    admin.from("nudges").select("id").eq("user_id", userId).eq("key", "dose-streak")
      .gte("created_at", new Date(now - 7 * 24 * H).toISOString()).limit(1),
  ]);

  const od = overdue.data ?? [];
  if (od.length) {
    out.push({
      key: "overdue",
      title: `📌 ${fa(od.length)} کار عقب افتاده`,
      body: `${od.slice(0, 2).map((i) => `«${i.content}»`).join(" و ")}${od.length > 2 ? " و…" : ""}. انجامش بدیم یا جابه‌جاش کنیم؟`,
      url: "/tasks/",
    });
  }

  const ms = missed.data ?? [];
  if (ms.length) {
    // deno-lint-ignore no-explicit-any
    const names = [...new Set(ms.map((d: any) => d.medications?.name).filter(Boolean))];
    out.push({
      key: "missed-doses",
      title: `💊 دیروز ${fa(ms.length)} دوز جا موند`,
      body: `${names.slice(0, 2).join("، ")}. اگه لازمه ساعت یادآوری رو عوض کنیم که با برنامه‌ات جور باشه.`,
      url: "/meds/",
    });
  }

  const ur = urgent.data ?? [];
  if (ur.length) {
    out.push({
      key: "urgent-mail",
      title: `📬 ${fa(ur.length)} ایمیل فوری هنوز باز نشده`,
      body: ur.map((e) => e.subject || "(بدون موضوع)").slice(0, 2).join(" · "),
      url: "/inbox/",
    });
  }

  if ((recentDone.count ?? 0) === 0 && (openCount.count ?? 0) >= 3) {
    out.push({
      key: "stuck",
      title: "🌱 سه روزه کاری تیک نخورده",
      body: "یه کار ۱۰ دقیقه‌ای انتخاب کن و همین الان انجامش بده؛ شروع کردن نصف راهه.",
      url: "/tasks/",
    });
  }

  const wk = week.data ?? [];
  if (wk.length >= 7 && wk.every((d) => d.status === "taken") && !(recentStreak.data ?? []).length) {
    out.push({
      key: "dose-streak",
      title: "🔥 هفت روز بی‌نقص!",
      body: `هفته‌ی گذشته همه‌ی ${fa(wk.length)} دوز داروهات رو سر وقت خوردی. عالیه، ادامه بده!`,
      url: "/meds/",
    });
  }
  return out;
}
