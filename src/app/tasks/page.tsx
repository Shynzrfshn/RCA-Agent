"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import AppShell from "@/components/AppShell";
import { CheckIcon, ClockIcon, EditIcon, MailIcon, PlusIcon, RepeatIcon, SearchIcon, SparkIcon, TrashIcon } from "@/components/Icons";
import { Empty, ErrorNote } from "@/components/ui";
import { addItem, completeItem } from "@/lib/data";
import { faDate, faWhen, fromLocalInput, toFa, toLocalInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { KIND_LABELS, PRIORITY_LABELS, type Item, type ItemKind } from "@/lib/types";

const FILTERS: { value: ItemKind | "all"; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "task", label: "کارها" },
  { value: "reminder", label: "یادآوری‌ها" },
  { value: "note", label: "یادداشت‌ها" },
  { value: "idea", label: "ایده‌ها" },
];
const RECURRENCE_LABELS = { daily: "هر روز", weekly: "هر هفته", monthly: "هر ماه" };
const PRIORITY_STYLES = [
  "bg-surface-2 text-muted",
  "bg-surface-2 text-muted",
  "bg-warning-soft text-warning",
  "bg-danger-bg text-danger",
];
const PAGE_SIZE = 50;

export default function TasksPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<ItemKind | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [search, setSearch] = useState("");
  const [day, setDay] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    let q = supabase.from("items").select("*", { count: "exact" }).eq("done", showDone);
    if (filter !== "all") q = q.eq("kind", filter);
    const term = search.trim().replace(/[%_]/g, "");
    if (term) q = q.ilike("content", `%${term}%`);
    if (day) {
      const start = new Date(`${day}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      q = q.gte("due_at", start.toISOString()).lt("due_at", end.toISOString());
    }
    q = showDone
      ? q.order("completed_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
      : q.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    const { data, error, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) setError(error.message);
    setItems((data as Item[]) ?? []);
    setTotal(count ?? 0);
  }, [supabase, showDone, filter, search, day, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on filter change
    load();
  }, [load]);

  async function toggle(item: Item) {
    setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
    try {
      await completeItem(item.id, !item.done);
      if (item.recurrence && !item.done) load();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  async function remove(item: Item) {
    if (!confirm(`«${item.content}» حذف بشه؟`)) return;
    setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) {
      setError(error.message);
      load();
    }
  }

  async function defer(item: Item) {
    const base = item.due_at ? new Date(item.due_at) : new Date();
    base.setDate(base.getDate() + 1);
    const { error } = await supabase.from("items").update({ due_at: base.toISOString(), notified_at: null }).eq("id", item.id);
    if (error) setError(error.message);
    else load();
  }

  const visible = items ?? [];
  const now = new Date().toISOString();
  const week = Array.from({ length: 7 }, (_, n) => { const date = new Date(); date.setDate(date.getDate() + n); return { key: toLocalInput(date.toISOString()).slice(0, 10), label: n === 0 ? "امروز" : faDate(date, { weekday: "short", month: undefined, day: "numeric" }) }; });

  return (
    <AppShell title="کارها و یادآوری‌ها" subtitle={items ? `${toFa(total)} مورد` : undefined}>
      <div className="space-y-6">
        {error && <ErrorNote>{error}</ErrorNote>}
        <NewItemForm key={editing?.id ?? "new"} initial={editing} onAdded={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block"><SearchIcon width={17} height={17} className="absolute right-3 top-3.5 text-muted" /><span className="sr-only">جست‌وجوی کارها</span><input className="field pr-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="جست‌وجو در کارها و یادداشت‌ها" /></label>
          <input type="date" className="field sm:w-44" aria-label="فیلتر تاریخ" value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="نمای هفت روز آینده">
          <button type="button" aria-pressed={!day} onClick={() => { setDay(""); setPage(1); }} className={`min-h-11 shrink-0 rounded-lg border px-4 text-sm ${!day ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface"}`}>همهٔ روزها</button>
          {week.map((d) => <button key={d.key} type="button" aria-pressed={day === d.key} onClick={() => { setDay(day === d.key ? "" : d.key); setPage(1); }} className={`min-h-11 shrink-0 rounded-lg border px-4 text-sm ${day === d.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface"}`}>{d.label}</button>)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => { setFilter(f.value); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  filter === f.value ? "bg-surface font-semibold shadow-sm" : "text-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={showDone} onChange={(e) => { setShowDone(e.target.checked); setPage(1); }} className="accent-[var(--accent)]" />
            نمایش انجام‌شده‌ها
          </label>
        </div>

        {items === null ? (
          <div className="card h-48 animate-pulse" />
        ) : visible.length === 0 ? (
          <Empty>{search || day ? "موردی با این جست‌وجو یا تاریخ پیدا نشد. فیلترها را تغییر بده." : showDone ? "هنوز چیزی انجام نشده." : "چیزی اینجا نیست. از بالا اضافه کن."}</Empty>
        ) : (
          <ul className="space-y-2">
            {visible.map((item) => (
              <li key={item.id} className="card animate-rise flex flex-wrap items-start gap-3 p-3.5 sm:flex-nowrap">
                <button
                  onClick={() => toggle(item)}
                  aria-label={item.done ? `برگردون: ${item.content}` : `انجام شد: ${item.content}`}
                  className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border-2 transition ${
                    item.done
                      ? "border-success bg-success text-white"
                      : "border-border text-transparent hover:border-accent hover:text-accent"
                  }`}
                >
                  <CheckIcon width={14} height={14} />
                </button>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className={item.done ? "text-muted line-through" : ""}>{item.content}</p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 text-accent">{KIND_LABELS[item.kind]}</span>
                    {item.priority !== 1 && (
                      <span className={`rounded-md px-2 py-0.5 ${PRIORITY_STYLES[item.priority]}`}>
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                    )}
                    {item.due_at && (
                      <span
                        className={`flex items-center gap-1 rounded-md px-2 py-0.5 ${
                          !item.done && item.due_at < now ? "bg-danger-bg text-danger" : "bg-surface-2 text-muted"
                        }`}
                      >
                        <ClockIcon width={12} height={12} />
                        {faWhen(item.due_at)}
                      </span>
                    )}
                    {item.recurrence && (
                      <span className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-muted">
                        <RepeatIcon width={12} height={12} />
                        {RECURRENCE_LABELS[item.recurrence]}
                      </span>
                    )}
                    {item.source === "email" && (
                      <Link href={`/inbox/?ref=${encodeURIComponent(item.source_ref ?? "")}`} className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-accent hover:underline"><MailIcon width={12} height={12} /> ایمیل مرتبط</Link>
                    )}
                    {item.source === "agent" && (
                      <span className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-muted">
                        <SparkIcon width={12} height={12} /> ایجنت
                      </span>
                    )}
                  </div>
                </div>
                {!item.done && <button onClick={() => defer(item)} className="btn btn-ghost shrink-0 px-3 text-xs" aria-label={`تعویق یک‌روزه: ${item.content}`}>فردا</button>}
                <button onClick={() => { setEditing(item); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`ویرایش: ${item.content}`} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-accent-soft hover:text-accent"><EditIcon width={17} height={17} /></button>
                <button
                  onClick={() => remove(item)}
                  aria-label={`حذف: ${item.content}`}
                  className="grid size-10 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger-bg hover:text-danger"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {total > PAGE_SIZE && <nav className="flex items-center justify-center gap-3" aria-label="صفحه‌بندی کارها"><button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>صفحهٔ قبل</button><span className="text-sm text-muted">صفحهٔ {toFa(page)} از {toFa(Math.ceil(total / PAGE_SIZE))}</span><button className="btn btn-ghost" disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>صفحهٔ بعد</button></nav>}
      </div>
    </AppShell>
  );
}

function NewItemForm({ onAdded, onCancel, initial }: { onAdded: () => void; onCancel: () => void; initial: Item | null }) {
  const ids = { content: useId(), kind: useId(), due: useId(), prio: useId(), rec: useId() };
  const [content, setContent] = useState(initial?.content ?? "");
  const [kind, setKind] = useState<ItemKind>(initial?.kind ?? "task");
  const [due, setDue] = useState(toLocalInput(initial?.due_at ?? null));
  const [priority, setPriority] = useState(initial?.priority ?? 1);
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const fields = {
        content: content.trim(),
        kind,
        due_at: fromLocalInput(due),
        priority,
        recurrence: (recurrence || null) as Item["recurrence"],
      };
      if (initial) {
        const { error } = await createClient().from("items").update(fields).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { data } = await createClient().auth.getUser();
        if (!data.user) throw new Error("وارد حساب نشده‌اید.");
        await addItem(data.user.id, fields);
      }
      setContent("");
      setDue("");
      setRecurrence("");
      setPriority(1);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      {initial && <div className="flex items-center justify-between"><strong className="text-sm">ویرایش مورد</strong><button type="button" className="text-sm text-muted hover:text-accent" onClick={onCancel}>انصراف</button></div>}
      <label htmlFor={ids.content} className="sr-only">متن</label>
      <input
        id={ids.content}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="کار یا یادآوری جدید…"
        className="field"
        required
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label htmlFor={ids.kind} className="mb-1 block text-xs text-muted">نوع</label>
          <select id={ids.kind} value={kind} onChange={(e) => setKind(e.target.value as ItemKind)} className="field py-2 text-sm">
            {Object.entries(KIND_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.due} className="mb-1 block text-xs text-muted">زمان</label>
          <input id={ids.due} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="field py-2 text-sm" />
        </div>
        <div>
          <label htmlFor={ids.prio} className="mb-1 block text-xs text-muted">اولویت</label>
          <select id={ids.prio} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="field py-2 text-sm">
            {PRIORITY_LABELS.map((l, i) => (
              <option key={i} value={i}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.rec} className="mb-1 block text-xs text-muted">تکرار</label>
          <select id={ids.rec} value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="field py-2 text-sm" disabled={!due}>
            <option value="">بدون تکرار</option>
            {Object.entries(RECURRENCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {error ? <span className="text-sm text-danger">{error}</span> : <span />}
        <button type="submit" disabled={busy} className="btn btn-primary">
          <PlusIcon width={16} height={16} />
          {busy ? "در حال ذخیره…" : initial ? "ذخیره تغییرات" : "اضافه کن"}
        </button>
      </div>
    </form>
  );
}

