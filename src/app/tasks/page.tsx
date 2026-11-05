"use client";

import { useCallback, useEffect, useId, useState } from "react";
import AppShell from "@/components/AppShell";
import { CheckIcon, ClockIcon, MailIcon, PlusIcon, RepeatIcon, SparkIcon, TrashIcon } from "@/components/Icons";
import { Empty, ErrorNote } from "@/components/ui";
import { addItem, completeItem } from "@/lib/data";
import { faWhen, fromLocalInput, toFa } from "@/lib/format";
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

export default function TasksPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<ItemKind | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from("items").select("*").eq("done", showDone).limit(300);
    q = showDone
      ? q.order("completed_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
      : q.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) setError(error.message);
    setItems((data as Item[]) ?? []);
  }, [supabase, showDone]);

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

  const visible = (items ?? []).filter((i) => filter === "all" || i.kind === filter);
  const now = new Date().toISOString();

  return (
    <AppShell title="کارها و یادآوری‌ها" subtitle={items ? `${toFa(visible.length)} مورد` : undefined}>
      <div className="space-y-6">
        {error && <ErrorNote>{error}</ErrorNote>}
        <NewItemForm onAdded={load} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  filter === f.value ? "bg-surface font-semibold shadow-sm" : "text-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[var(--accent)]" />
            نمایش انجام‌شده‌ها
          </label>
        </div>

        {items === null ? (
          <div className="card h-48 animate-pulse" />
        ) : visible.length === 0 ? (
          <Empty>{showDone ? "هنوز چیزی انجام نشده." : "چیزی اینجا نیست. از بالا اضافه کن."}</Empty>
        ) : (
          <ul className="space-y-2">
            {visible.map((item) => (
              <li key={item.id} className="card animate-rise flex items-start gap-3 p-3.5">
                <button
                  onClick={() => toggle(item)}
                  aria-label={item.done ? `برگردون: ${item.content}` : `انجام شد: ${item.content}`}
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition ${
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
                      <span className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-muted">
                        <MailIcon width={12} height={12} /> از ایمیل
                      </span>
                    )}
                    {item.source === "agent" && (
                      <span className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-muted">
                        <SparkIcon width={12} height={12} /> ایجنت
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(item)}
                  aria-label={`حذف: ${item.content}`}
                  className="rounded-lg p-1.5 text-muted transition hover:bg-danger-bg hover:text-danger"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function NewItemForm({ onAdded }: { onAdded: () => void }) {
  const ids = { content: useId(), kind: useId(), due: useId(), prio: useId(), rec: useId() };
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<ItemKind>("task");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState(1);
  const [recurrence, setRecurrence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await createClient().auth.getUser();
      await addItem(data.user!.id, {
        content: content.trim(),
        kind,
        due_at: fromLocalInput(due),
        priority,
        recurrence: (recurrence || null) as Item["recurrence"],
      });
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
          {busy ? "در حال ثبت…" : "اضافه کن"}
        </button>
      </div>
    </form>
  );
}
