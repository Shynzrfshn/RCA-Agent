"use client";

import { useCallback, useEffect, useId, useState } from "react";
import AppShell from "@/components/AppShell";
import { PillIcon, PlusIcon, TrashIcon } from "@/components/Icons";
import { Empty, ErrorNote, ProgressRing, Section } from "@/components/ui";
import { loadDoses, setDoseStatus, todayBounds } from "@/lib/data";
import { faDate, faTime, toFa } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Dose, Medication } from "@/lib/types";

const COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f97316", "#10b981", "#0ea5e9"];
const WEEKDAYS = ["ی", "د", "س", "چ", "پ", "ج", "ش"]; // Sun..Sat
const STATUS = {
  pending: { label: "در انتظار", cls: "bg-surface-2 text-muted" },
  taken: { label: "مصرف شد", cls: "bg-success-soft text-success" },
  skipped: { label: "رد شد", cls: "bg-warning-soft text-warning" },
  missed: { label: "فراموش شد", cls: "bg-danger-bg text-danger" },
};

export default function MedsPage() {
  const supabase = createClient();
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [stats, setStats] = useState<{ day: string; taken: number; total: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .eq("active", true)
      .order("created_at");
    if (error) {
      setError(
        error.code === "42P01" || /does not exist|schema cache/.test(error.message)
          ? "جدول داروها هنوز ساخته نشده. migration نسخه ۲ رو در Supabase اجرا کن."
          : error.message,
      );
      setMeds([]);
      return;
    }
    setMeds(data as Medication[]);
    const { start, end } = todayBounds();
    loadDoses(start, end).then(setDoses, (e) => setError(e.message));
    supabase.rpc("adherence", { p_days: 14 }).then(({ data }) => setStats((data as typeof stats) ?? []));
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  async function mark(d: Dose, status: Dose["status"]) {
    setDoses((prev) => prev.map((x) => (x.id === d.id ? { ...x, status } : x)));
    try {
      await setDoseStatus(d.id, status);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function stop(m: Medication) {
    if (!confirm(`مصرف «${m.name}» متوقف بشه؟ (سابقه‌اش می‌مونه)`)) return;
    const { error } = await supabase.from("medications").update({ active: false }).eq("id", m.id);
    if (error) return setError(error.message);
    await supabase
      .from("dose_logs")
      .delete()
      .eq("medication_id", m.id)
      .eq("status", "pending")
      .gt("scheduled_for", new Date().toISOString());
    load();
  }

  async function updateStock(m: Medication) {
    const raw = prompt(`موجودی فعلی «${m.name}» (تعداد):`, m.stock?.toString() ?? "");
    if (raw === null) return;
    const stock = raw.trim() === "" ? null : Number(raw.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))));
    if (stock !== null && Number.isNaN(stock)) return;
    const { error } = await supabase.from("medications").update({ stock, refill_notified_on: null }).eq("id", m.id);
    if (error) setError(error.message);
    load();
  }

  const taken = doses.filter((d) => d.status === "taken").length;
  const totalTaken = stats.reduce((a, s) => a + s.taken, 0);
  const totalAll = stats.reduce((a, s) => a + s.total, 0);

  return (
    <AppShell
      title="داروها"
      subtitle="یادآور هوشمند با اعلان، پیگیری موجودی و آمار مصرف"
      action={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          <PlusIcon width={16} height={16} /> داروی جدید
        </button>
      }
    >
      <div className="space-y-8">
        {error && <ErrorNote>{error}</ErrorNote>}
        {adding && (
          <NewMedForm
            onDone={() => {
              setAdding(false);
              load();
            }}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Section title="دوزهای امروز">
            {doses.length === 0 ? (
              <Empty>امروز دوزی برنامه‌ریزی نشده.</Empty>
            ) : (
              <div className="card p-4">
                <div className="mb-4 flex items-center gap-4">
                  <ProgressRing value={taken} total={doses.length} label="امروز" />
                  <p className="text-sm leading-6 text-muted">
                    {taken === doses.length ? "همه رو خوردی! 💪" : `${toFa(doses.length - taken)} دوز باقی مونده`}
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {doses.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-3">
                      <span className="w-12 text-sm font-semibold tabular-nums">{faTime(d.scheduled_for)}</span>
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.medications?.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{d.medications?.name}</div>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS[d.status].cls}`}>
                          {STATUS[d.status].label}
                        </span>
                      </div>
                      {d.status === "taken" || d.status === "skipped" ? (
                        <button className="btn btn-ghost px-2.5 py-1.5 text-xs" onClick={() => mark(d, "pending")}>
                          برگرد
                        </button>
                      ) : (
                        <div className="flex gap-1.5">
                          <button className="btn btn-ghost px-2.5 py-1.5 text-xs" onClick={() => mark(d, "skipped")}>
                            رد
                          </button>
                          <button className="btn btn-primary px-2.5 py-1.5 text-xs" onClick={() => mark(d, "taken")}>
                            خوردم
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="پایبندی ۱۴ روز اخیر">
            <div className="card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-3xl font-bold">
                  {totalAll ? `${toFa(Math.round((totalTaken / totalAll) * 100))}٪` : "—"}
                </span>
                <span className="text-xs text-muted">
                  {toFa(totalTaken)} از {toFa(totalAll)} دوز
                </span>
              </div>
              <AdherenceChart data={stats} />
            </div>
          </Section>
        </div>

        <Section title="داروهای فعال">
          {meds === null ? (
            <div className="card h-32 animate-pulse" />
          ) : meds.length === 0 ? (
            <Empty>هنوز دارویی ثبت نکردی. از «داروی جدید» شروع کن یا به ایجنت بگو.</Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {meds.map((m) => {
                const low = m.stock !== null && m.stock <= m.refill_threshold;
                return (
                  <li key={m.id} className="card animate-rise space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: m.color }}>
                        <PillIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{m.name}</div>
                        <div className="text-xs text-muted">
                          {[m.dosage, m.instructions].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => stop(m)}
                        aria-label={`توقف ${m.name}`}
                        className="rounded-lg p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger"
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.times.map((t) => (
                        <span key={t} className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent tabular-nums">
                          {t.slice(0, 5).replace(/\d/g, (c) => toFa(Number(c)))}
                        </span>
                      ))}
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                        {m.days_of_week ? m.days_of_week.map((d) => WEEKDAYS[d]).join("، ") : "هر روز"}
                      </span>
                    </div>
                    <button
                      onClick={() => updateStock(m)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs ${
                        low ? "bg-danger-bg text-danger" : "bg-surface-2 text-muted"
                      }`}
                    >
                      <span>{m.stock === null ? "موجودی ثبت نشده" : `موجودی: ${toFa(m.stock)} عدد`}</span>
                      <span>{low ? "وقت تهیه‌ست!" : "ویرایش"}</span>
                    </button>
                    {m.end_date && <div className="text-xs text-muted">تا {faDate(m.end_date, { weekday: undefined })}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <p className="pb-4 text-center text-xs text-muted">
          RCA Agent جایگزین پزشک یا داروساز نیست. تغییر دوز فقط با نظر پزشک.
        </p>
      </div>
    </AppShell>
  );
}

function AdherenceChart({ data }: { data: { day: string; taken: number; total: number }[] }) {
  // Fill the last 14 days so missing days show as empty bars.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toLocaleDateString("en-CA");
    return data.find((x) => x.day === key) ?? { day: key, taken: 0, total: 0 };
  });
  return (
    <div className="flex h-32 items-end gap-1.5" role="img" aria-label="نمودار پایبندی روزانه">
      {days.map((d) => {
        const pct = d.total ? d.taken / d.total : 0;
        return (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="absolute inset-x-0 bottom-0 top-0 rounded-md bg-surface-2" />
            <div
              className={`relative rounded-md ${pct === 1 ? "gradient-accent" : pct > 0 ? "bg-warning" : ""}`}
              style={{ height: `${Math.max(pct * 100, d.total ? 4 : 0)}%`, transition: "height .5s" }}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
              {faDate(d.day, { weekday: undefined, month: "short" })}: {toFa(d.taken)}/{toFa(d.total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NewMedForm({ onDone }: { onDone: () => void }) {
  const id = useId();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [days, setDays] = useState<number[] | null>(null);
  const [stock, setStock] = useState("");
  const [doseAmount, setDoseAmount] = useState("1");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || times.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("medications").insert({
      user_id: u.user!.id,
      name: name.trim(),
      dosage: dosage || null,
      instructions: instructions || null,
      times: [...new Set(times)].sort(),
      days_of_week: days && days.length ? days : null,
      stock: stock ? Number(stock) : null,
      dose_amount: Number(doseAmount) || 1,
      end_date: endDate || null,
      color,
    });
    setBusy(false);
    if (error) return setError(error.message);
    await supabase.rpc("ensure_my_doses");
    onDone();
  }

  return (
    <form onSubmit={submit} className="card animate-rise space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="نام دارو" htmlFor={`${id}-n`}>
          <input id={`${id}-n`} className="field" value={name} onChange={(e) => setName(e.target.value)} required placeholder="مثلاً متفورمین" />
        </Field>
        <Field label="دوز" htmlFor={`${id}-d`}>
          <input id={`${id}-d`} className="field" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="۵۰۰ میلی‌گرم" />
        </Field>
        <Field label="دستور مصرف" htmlFor={`${id}-i`}>
          <input id={`${id}-i`} className="field" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="بعد از غذا" />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs text-muted">ساعت‌های مصرف</legend>
        <div className="flex flex-wrap items-center gap-2">
          {times.map((t, i) => (
            <span key={i} className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
              <input
                type="time"
                aria-label={`ساعت ${i + 1}`}
                value={t}
                onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                className="rounded-lg bg-transparent px-2 py-1 text-sm outline-none"
                required
              />
              {times.length > 1 && (
                <button type="button" aria-label="حذف ساعت" onClick={() => setTimes(times.filter((_, j) => j !== i))} className="px-1.5 text-muted hover:text-danger">
                  ×
                </button>
              )}
            </span>
          ))}
          <button type="button" className="btn btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setTimes([...times, "20:00"])}>
            <PlusIcon width={14} height={14} /> ساعت دیگه
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-xs text-muted">روزها</legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDays(null)}
            aria-pressed={days === null}
            className={`rounded-lg px-3 py-1.5 text-xs ${days === null ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted"}`}
          >
            هر روز
          </button>
          {[6, 0, 1, 2, 3, 4, 5].map((d) => {
            const on = days?.includes(d) ?? false;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDays(on ? (days ?? []).filter((x) => x !== d) : [...(days ?? []), d])}
                className={`size-8 rounded-lg text-xs ${on ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted"}`}
              >
                {WEEKDAYS[d]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="موجودی (عدد)" htmlFor={`${id}-s`}>
          <input id={`${id}-s`} type="number" min="0" className="field" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="اختیاری" />
        </Field>
        <Field label="تعداد در هر نوبت" htmlFor={`${id}-a`}>
          <input id={`${id}-a`} type="number" min="0.25" step="0.25" className="field" value={doseAmount} onChange={(e) => setDoseAmount(e.target.value)} />
        </Field>
        <Field label="تا تاریخ" htmlFor={`${id}-e`}>
          <input id={`${id}-e`} type="date" className="field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="radiogroup" aria-label="رنگ">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={`size-7 rounded-full transition ${color === c ? "ring-2 ring-ring ring-offset-2 ring-offset-surface" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-sm text-danger">{error}</span>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "در حال ذخیره…" : "ذخیره دارو"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-muted">{label}</label>
      {children}
    </div>
  );
}
