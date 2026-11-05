// Called every minute by pg_cron (see supabase/cron.sql).
// Sends medication and reminder push notifications, refill alerts, and the
// morning briefing.
import { HttpError, isCron, json, serve } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { pushToUser } from "../_shared/push.ts";
import { sign } from "../_shared/crypto.ts";
import { faTime, localParts } from "../_shared/time.ts";
import { generateBriefing } from "../_shared/agent.ts";

const RENOTIFY_MINUTES = 15;
const MAX_NOTIFIES = 3;
const MISSED_AFTER_HOURS = 3;

serve(async (req) => {
  if (!isCron(req)) throw new HttpError(401, "unauthorized");
  const admin = adminClient();
  const now = new Date();
  const stats = { doses: 0, missed: 0, items: 0, refills: 0, briefings: 0 };

  await admin.rpc("ensure_dose_logs", { p_days: 2, p_user: null });

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, timezone, briefing_hour, briefing_enabled");
  const tzOf = new Map((profiles ?? []).map((p) => [p.user_id, p.timezone as string]));
  const tz = (uid: string) => tzOf.get(uid) ?? "Asia/Tehran";

  // 1) Mark long-pending doses as missed.
  const { data: missed } = await admin
    .from("dose_logs")
    .update({ status: "missed" })
    .eq("status", "pending")
    .lt("scheduled_for", new Date(now.getTime() - MISSED_AFTER_HOURS * 3600_000).toISOString())
    .select("id");
  stats.missed = missed?.length ?? 0;

  // 2) Due doses (with re-notify and snooze).
  const { data: doses } = await admin
    .from("dose_logs")
    .select("id, user_id, scheduled_for, notify_count, last_notified_at, snooze_until, medications(name, dosage, instructions)")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .lt("notify_count", MAX_NOTIFIES)
    .limit(500);
  const renotifyBefore = now.getTime() - RENOTIFY_MINUTES * 60_000;
  const due = (doses ?? []).filter(
    (d) =>
      (!d.snooze_until || new Date(d.snooze_until).getTime() <= now.getTime()) &&
      (!d.last_notified_at || new Date(d.last_notified_at).getTime() <= renotifyBefore),
  );
  for (const d of due) {
    // deno-lint-ignore no-explicit-any
    const med = d.medications as any;
    const token = await sign({ t: "dose", id: d.id, uid: d.user_id }, 24 * 3600);
    await pushToUser(admin, d.user_id, {
      title: `💊 وقت ${med?.name ?? "دارو"}`,
      body: [med?.dosage, med?.instructions, `ساعت ${faTime(d.scheduled_for, tz(d.user_id))}`]
        .filter(Boolean)
        .join(" · "),
      url: "/meds/",
      tag: `dose-${d.id}`,
      actionToken: token,
      actions: [
        { action: "take", title: "✅ خوردم" },
        { action: "snooze", title: "⏰ ۱۵ دقیقه بعد" },
      ],
    });
    await admin
      .from("dose_logs")
      .update({ notify_count: d.notify_count + 1, last_notified_at: now.toISOString(), snooze_until: null })
      .eq("id", d.id);
    stats.doses++;
  }

  // 3) Due reminders/tasks.
  const { data: items } = await admin
    .from("items")
    .select("id, user_id, kind, content, due_at")
    .eq("done", false)
    .is("notified_at", null)
    .lte("due_at", now.toISOString())
    .gte("due_at", new Date(now.getTime() - 24 * 3600_000).toISOString())
    .limit(200);
  for (const it of items ?? []) {
    const token = await sign({ t: "item", id: it.id, uid: it.user_id }, 7 * 24 * 3600);
    await pushToUser(admin, it.user_id, {
      title: it.kind === "reminder" ? "🔔 یادآوری" : "📌 موعد کار",
      body: it.content,
      url: "/tasks/",
      tag: `item-${it.id}`,
      actionToken: token,
      actions: [
        { action: "done", title: "✅ انجام شد" },
        { action: "snooze", title: "⏰ ۱ ساعت بعد" },
      ],
    });
    await admin.from("items").update({ notified_at: now.toISOString() }).eq("id", it.id);
    stats.items++;
  }

  // 4) Refill alerts, once per local day.
  const { data: meds } = await admin
    .from("medications")
    .select("id, user_id, name, stock, refill_threshold, refill_notified_on")
    .eq("active", true)
    .not("stock", "is", null);
  for (const m of meds ?? []) {
    const today = localParts(tz(m.user_id)).date;
    if (m.stock > m.refill_threshold || m.refill_notified_on === today) continue;
    await pushToUser(admin, m.user_id, {
      title: `🧾 ${m.name} داره تموم می‌شه`,
      body: `فقط ${new Intl.NumberFormat("fa-IR").format(m.stock)} عدد مونده. وقت تهیه‌ی دوباره است.`,
      url: "/meds/",
      tag: `refill-${m.id}`,
    });
    await admin.from("medications").update({ refill_notified_on: today }).eq("id", m.id);
    stats.refills++;
  }

  // 5) Morning briefing at each user's chosen local hour (max 3 per tick).
  for (const p of profiles ?? []) {
    if (!p.briefing_enabled || stats.briefings >= 3) continue;
    const lp = localParts(p.timezone);
    if (lp.hour !== p.briefing_hour) continue;
    const { data: existing } = await admin
      .from("briefings")
      .select("id")
      .eq("user_id", p.user_id)
      .eq("day", lp.date)
      .maybeSingle();
    if (existing) continue;
    // Claim the slot first so overlapping ticks don't double-generate.
    const { error: claimErr } = await admin
      .from("briefings")
      .insert({ user_id: p.user_id, day: lp.date, content: "در حال آماده‌سازی…" });
    if (claimErr) continue;
    try {
      const content = await generateBriefing(admin, p.user_id);
      await admin.from("briefings").update({ content }).eq("user_id", p.user_id).eq("day", lp.date);
      await pushToUser(admin, p.user_id, {
        title: "☀️ خلاصه‌ی امروزت آماده‌ست",
        body: content.replace(/[#*_`>]/g, "").slice(0, 140),
        url: "/dashboard/",
        tag: `briefing-${lp.date}`,
      });
      stats.briefings++;
    } catch (err) {
      console.error("briefing failed", p.user_id, err);
      await admin.from("briefings").delete().eq("user_id", p.user_id).eq("day", lp.date);
    }
  }

  return json(stats);
});
