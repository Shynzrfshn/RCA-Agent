"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { CheckIcon, ClockIcon, MailIcon, PillIcon, SparkIcon } from "@/components/Icons";
import { Empty, ErrorNote, ProgressRing, Section, StatCard } from "@/components/ui";
import { completeItem, loadDoses, loadOpenItems, setDoseStatus, todayBounds } from "@/lib/data";
import { faDate, faTime, faWhen, greeting, toFa } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Dose, Item } from "@/lib/types";
import SmartCapture from "./SmartCapture";
import { NudgesCard, ReviewsCard } from "./AgentPanels";

export default function DashboardPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[] | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [urgentMail, setUrgentMail] = useState(0);
  const [adherence, setAdherence] = useState<{ taken: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { start, end } = todayBounds();
    try {
      setItems(await loadOpenItems());
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    }
    // The rest needs the v2 migration; fail soft.
    loadDoses(start, end).then(setDoses, () => setDoses([]));
    supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .eq("category", "urgent")
      .then(({ count }) => setUrgentMail(count ?? 0));
    supabase.rpc("adherence", { p_days: 7 }).then(({ data }) => {
      if (!data) return;
      const rows = data as { taken: number; total: number }[];
      setAdherence({
        taken: rows.reduce((a, r) => a + r.taken, 0),
        total: rows.reduce((a, r) => a + r.total, 0),
      });
    });
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  const { end } = todayBounds();
  const dueToday = useMemo(
    () => (items ?? []).filter((i) => i.due_at && i.due_at < end),
    [items, end],
  );
  const overdue = dueToday.filter((i) => i.due_at! < new Date().toISOString());
  const takenToday = doses.filter((d) => d.status === "taken").length;

  const timeline = useMemo(() => {
    const rows = [
      ...doses.map((d) => ({ kind: "dose" as const, at: d.scheduled_for, dose: d })),
      ...dueToday.map((i) => ({ kind: "item" as const, at: i.due_at!, item: i })),
    ];
    return rows.sort((a, b) => a.at.localeCompare(b.at));
  }, [doses, dueToday]);

  async function markDose(d: Dose, status: "taken" | "skipped" | "pending") {
    setDoses((prev) => prev.map((x) => (x.id === d.id ? { ...x, status } : x)));
    try {
      await setDoseStatus(d.id, status);
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  async function finishItem(i: Item) {
    setItems((prev) => prev?.filter((x) => x.id !== i.id) ?? prev);
    try {
      await completeItem(i.id);
      if (i.recurrence) load();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  return (
    <AppShell title={`${greeting()} 👋`} subtitle={faDate(new Date(), { year: "numeric" })}>
      <div className="space-y-8">
        {error && <ErrorNote>{error}</ErrorNote>}

        <SmartCapture onChanged={load} />

        <NudgesCard />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="کارهای امروز"
            value={toFa(dueToday.length)}
            hint={overdue.length ? `${toFa(overdue.length)} عقب‌افتاده` : "همه سر وقت"}
            tone={overdue.length ? "danger" : "accent"}
            icon={<CheckIcon width={16} height={16} />}
          />
          <StatCard
            label="داروهای امروز"
            value={`${toFa(takenToday)}/${toFa(doses.length)}`}
            hint={doses.length ? "دوز مصرف‌شده" : "دارویی ثبت نشده"}
            tone="success"
            icon={<PillIcon width={16} height={16} />}
          />
          <StatCard
            label="ایمیل فوری"
            value={toFa(urgentMail)}
            hint={<Link href="/inbox/" className="underline-offset-2 hover:underline">صندوق ورودی</Link>}
            tone={urgentMail ? "warning" : "accent"}
            icon={<MailIcon width={16} height={16} />}
          />
          <StatCard
            label="پایبندی ۷ روز"
            value={adherence?.total ? `${toFa(Math.round((adherence.taken / adherence.total) * 100))}٪` : "—"}
            hint="مصرف به‌موقع دارو"
            tone="success"
            icon={<SparkIcon width={16} height={16} />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Section title="برنامه‌ی امروز">
            {items === null ? (
              <div className="card h-40 animate-pulse" />
            ) : timeline.length === 0 ? (
              <Empty>برای امروز چیزی زمان‌بندی نشده. یه یادآوری بساز یا داروهات رو اضافه کن.</Empty>
            ) : (
              <ol className="card divide-y divide-border overflow-hidden">
                {timeline.map((row) =>
                  row.kind === "dose" ? (
                    <li key={`d-${row.dose.id}`} className="flex items-center gap-3 p-3.5">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-xl text-white"
                        style={{ background: row.dose.medications?.color ?? "var(--accent)" }}
                      >
                        <PillIcon width={18} height={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium ${row.dose.status === "taken" ? "text-muted line-through" : ""}`}>
                          {row.dose.medications?.name}
                          {row.dose.medications?.dosage && (
                            <span className="text-sm font-normal text-muted"> · {row.dose.medications.dosage}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          {faTime(row.dose.scheduled_for)}
                          {row.dose.status === "missed" && " · فراموش شد"}
                          {row.dose.status === "skipped" && " · رد شد"}
                        </div>
                      </div>
                      {row.dose.status === "taken" ? (
                        <button className="btn btn-ghost text-xs" onClick={() => markDose(row.dose, "pending")}>
                          برگرد
                        </button>
                      ) : (
                        <button className="btn btn-primary text-xs" onClick={() => markDose(row.dose, "taken")}>
                          خوردم
                        </button>
                      )}
                    </li>
                  ) : (
                    <li key={`i-${row.item.id}`} className="flex items-center gap-3 p-3.5">
                      <button
                        aria-label={`انجام شد: ${row.item.content}`}
                        onClick={() => finishItem(row.item)}
                        className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-border text-transparent transition hover:border-accent hover:text-accent"
                      >
                        <CheckIcon width={18} height={18} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{row.item.content}</div>
                        <div
                          className={`flex items-center gap-1 text-xs ${
                            row.item.due_at! < new Date().toISOString() ? "text-danger" : "text-muted"
                          }`}
                        >
                          <ClockIcon width={12} height={12} />
                          {faWhen(row.item.due_at!)}
                        </div>
                      </div>
                    </li>
                  ),
                )}
              </ol>
            )}
          </Section>

          <Section title="مرور ایجنت">
            <ReviewsCard />
            {doses.length > 0 && (
              <div className="card flex items-center gap-4 p-4">
                <ProgressRing value={takenToday} total={doses.length} label="دوز امروز" />
                <div className="text-sm leading-6 text-muted">
                  {takenToday === doses.length
                    ? "همه‌ی داروهای امروز رو خوردی. عالیه! 🎉"
                    : `${toFa(doses.length - takenToday)} دوز دیگه مونده.`}
                  <Link href="/meds/" className="mt-1 block text-accent">مدیریت داروها ←</Link>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
