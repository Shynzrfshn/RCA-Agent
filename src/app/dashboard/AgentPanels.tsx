"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshIcon, SparkIcon } from "@/components/Icons";
import { Markdownish } from "@/components/ui";
import { callFunction } from "@/lib/api";
import { faDate, relative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Kind = "morning" | "evening" | "weekly";
type Review = { day: string; kind: Kind; content: string; created_at: string };

const TABS: { kind: Kind; label: string; empty: string }[] = [
  { kind: "morning", label: "☀️ صبح", empty: "هر صبح ایجنت یه خلاصه از کارها، داروها و ایمیل‌های مهمت می‌نویسه." },
  { kind: "evening", label: "🌙 شب", empty: "هر شب ایجنت روزت رو مرور می‌کنه و برنامه‌ی فردا رو پیشنهاد می‌ده." },
  { kind: "weekly", label: "📊 هفته", empty: "آخر هر هفته یه مرور با آمار، نقاط قوت و اولویت‌های هفته‌ی بعد." },
];

/** Morning briefing / evening review / weekly review, with manual refresh. */
export function ReviewsCard() {
  const [reviews, setReviews] = useState<Partial<Record<Kind, Review>>>({});
  const [tab, setTab] = useState<Kind>(() => {
    const h = new Date().getHours();
    return h >= 18 ? "evening" : "morning";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("briefings")
      .select("day, kind, content, created_at")
      .order("day", { ascending: false })
      .limit(15)
      .then(({ data }) => {
        const latest: Partial<Record<Kind, Review>> = {};
        for (const r of (data as Review[]) ?? []) latest[r.kind ?? "morning"] ??= r;
        setReviews(latest);
      });
  }, []);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const r = await callFunction<Review>("agent", { action: "briefing", kind: tab });
      setReviews((prev) => ({ ...prev, [tab]: { ...r, kind: tab } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const current = reviews[tab];
  const info = TABS.find((t) => t.kind === tab)!;

  return (
    <div className="card relative overflow-hidden p-5">
      <div className="gradient-accent pointer-events-none absolute -top-16 -left-16 size-40 rounded-full opacity-20 blur-2xl" />
      <div className="relative mb-4 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="نوع مرور" className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {TABS.map((t) => (
            <button
              key={t.kind}
              role="tab"
              aria-selected={tab === t.kind}
              onClick={() => setTab(t.kind)}
              className={`rounded-lg px-2.5 py-1 text-xs transition ${
                tab === t.kind ? "bg-surface font-semibold shadow-sm" : "text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={refresh} disabled={busy} className="btn btn-ghost px-2.5 py-1.5 text-xs">
          <RefreshIcon width={14} height={14} className={busy ? "animate-spin" : ""} />
          {busy ? "در حال نوشتن…" : current ? "بروزرسانی" : "بساز"}
        </button>
      </div>
      <div className="relative" role="tabpanel">
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        {current ? (
          <>
            <div className="mb-2 text-xs text-muted">{faDate(current.day)}</div>
            <Markdownish text={current.content} />
          </>
        ) : (
          <p className="text-sm leading-7 text-muted">{info.empty} الان هم می‌تونی بسازیش.</p>
        )}
      </div>
    </div>
  );
}

type Nudge = { id: string; title: string; body: string; url: string | null; created_at: string };

/** The agent's proactive observations ("I noticed…"). */
export function NudgesCard() {
  const [nudges, setNudges] = useState<Nudge[]>([]);

  const load = useCallback(() => {
    createClient()
      .from("nudges")
      .select("id, title, body, url, created_at")
      .eq("dismissed", false)
      .gte("created_at", new Date(Date.now() - 2 * 86400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setNudges((data as Nudge[]) ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function dismiss(id: string) {
    setNudges((n) => n.filter((x) => x.id !== id));
    await createClient().from("nudges").update({ dismissed: true }).eq("id", id);
  }

  if (!nudges.length) return null;
  return (
    <section aria-label="پیشنهادهای ایجنت" className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted">
        <SparkIcon width={14} height={14} className="text-accent" /> ایجنت حواسش هست
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {nudges.map((n) => (
          <li key={n.id} className="card animate-rise flex items-start gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{n.title}</div>
              <p className="mt-0.5 text-xs leading-5 text-muted">{n.body}</p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                {n.url && (
                  <Link href={n.url} className="text-accent">
                    بریم ←
                  </Link>
                )}
                <span className="text-muted">{relative(n.created_at)}</span>
              </div>
            </div>
            <button
              onClick={() => dismiss(n.id)}
              aria-label="بستن"
              className="rounded-md px-1.5 text-muted hover:text-foreground"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
