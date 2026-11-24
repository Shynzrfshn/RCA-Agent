"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { ErrorNote } from "@/components/ui";
import { faWhen, toFa } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Category = "bill" | "document" | "followup" | "appointment" | "stock";
type RecordRow = { id: string; category: Category; title: string; details: string | null; counterparty: string | null; due_at: string | null; amount: number | null; quantity: number | null; threshold: number | null; status: string; notified_at: string | null; created_at: string };
type Version = { id: string; record_id: string; previous: RecordRow; created_at: string };
type Action = { id: string; tool: string; result: { ok?: boolean; confirmed?: boolean } | null; created_at: string };
const CATEGORIES: { value: Category; label: string; help: string }[] = [
  { value: "bill", label: "قبض و اشتراک", help: "یک روز پیش از موعد یادآوری می‌شود." },
  { value: "document", label: "مدرک", help: "هفت روز پیش از انقضا یادآوری می‌شود." },
  { value: "followup", label: "پیگیری ایمیل", help: "اگر پاسخ مرتبط برسد، وضعیت آن مشخص می‌شود." },
  { value: "appointment", label: "قرار", help: "یک روز پیش از قرار یادآوری می‌شود." },
  { value: "stock", label: "موجودی خانه", help: "وقتی مقدار به آستانه برسد هشدار می‌دهد." },
];
const label = (value: string) => CATEGORIES.find((x) => x.value === value)?.label ?? value;

export default function AssistantPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [category, setCategory] = useState<Category>("bill");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [due, setDue] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [threshold, setThreshold] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [records, history, audit] = await Promise.all([
      supabase.from("assistant_records").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("assistant_record_versions").select("id, record_id, previous, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("agent_actions").select("id, tool, result, created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    if (records.error) setError(records.error.message);
    setRows((records.data as RecordRow[]) ?? []);
    setVersions((history.data as Version[]) ?? []);
    setActions((audit.data as Action[]) ?? []);
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server data load
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("assistant_records").insert({
      user_id: auth.user?.id, category, title: title.trim(), details: details.trim() || null,
      counterparty: counterparty.trim() || null, due_at: due ? new Date(due).toISOString() : null,
      amount: amount ? Number(amount) : null, quantity: quantity ? Number(quantity) : null,
      threshold: threshold ? Number(threshold) : null,
    });
    if (insertError) setError(insertError.message);
    else { setTitle(""); setDetails(""); setCounterparty(""); setDue(""); setAmount(""); setQuantity(""); setThreshold(""); await load(); }
    setBusy(false);
  }
  async function markDone(row: RecordRow) {
    const { error: updateError } = await supabase.from("assistant_records")
      .update({ status: row.status === "done" ? "active" : "done", updated_at: new Date().toISOString() }).eq("id", row.id);
    if (updateError) setError(updateError.message); else load();
  }
  async function restore(row: RecordRow) {
    const version = versions.find((x) => x.record_id === row.id);
    if (!version) return;
    const old = version.previous;
    const { error: updateError } = await supabase.from("assistant_records").update({
      title: old.title, details: old.details, counterparty: old.counterparty, due_at: old.due_at,
      amount: old.amount, quantity: old.quantity, threshold: old.threshold, status: old.status,
      notified_at: old.notified_at ?? null, updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (updateError) setError(updateError.message); else load();
  }
  const shown = rows.filter((row) => `${row.title} ${row.details ?? ""} ${row.counterparty ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <AppShell title="پیگیری‌های هوشمند" subtitle="قبض‌ها، مدارک، قرارها، ایمیل‌های بی‌پاسخ و موجودی خانه">
    <div className="grid gap-6 pb-10 lg:grid-cols-[1.2fr_1fr]">
      <section className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <input className="field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجوی پیگیری‌ها" aria-label="جست‌وجوی پیگیری‌ها" />
        <div className="space-y-2">{shown.length ? shown.map((row) => <article key={row.id} className="card p-4">
          <div className="flex items-start justify-between gap-3"><div><span className="text-xs text-accent">{label(row.category)}</span><h2 className="font-semibold">{row.title}</h2></div><span className="text-xs text-muted">{row.status === "done" ? "انجام شد" : row.status === "response_detected" ? "پاسخ شناسایی شد" : "فعال"}</span></div>
          {row.details && <p className="mt-2 text-sm text-muted">{row.details}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">{row.due_at && <span>{faWhen(row.due_at)}</span>}{row.amount !== null && <span>مبلغ: {toFa(row.amount)}</span>}{row.quantity !== null && <span>موجودی: {toFa(row.quantity)}</span>}{row.counterparty && <span>{row.counterparty}</span>}</div>
          <div className="mt-3 flex gap-2"><button className="btn btn-ghost text-xs" onClick={() => markDone(row)}>{row.status === "done" ? "فعال‌سازی دوباره" : "انجام شد"}</button>{versions.some((x) => x.record_id === row.id) && <button className="btn btn-ghost text-xs" onClick={() => restore(row)}>بازگردانی آخرین تغییر</button>}</div>
        </article>) : <div className="card p-8 text-sm text-muted">هنوز موردی ثبت نشده است.</div>}</div>
      </section>
      <div className="space-y-5"><form onSubmit={create} className="card space-y-3 p-5"><h2 className="font-bold">پیگیری تازه</h2>
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value as Category)}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <p className="text-xs text-muted">{CATEGORIES.find((c) => c.value === category)?.help}</p>
        <input className="field" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان" aria-label="عنوان" />
        <textarea className="field" maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="جزئیات اختیاری" aria-label="جزئیات" />
        <input className="field" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="طرف مقابل یا نشانی ایمیل (اختیاری)" aria-label="طرف مقابل" />
        <label className="block text-xs text-muted">موعد<input type="datetime-local" className="field mt-1" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        {category === "bill" && <input type="number" min="0" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مبلغ اختیاری" aria-label="مبلغ" />}
        {category === "stock" && <div className="grid grid-cols-2 gap-2"><input type="number" min="0" className="field" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="موجودی" aria-label="موجودی" /><input type="number" min="0" className="field" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="آستانه هشدار" aria-label="آستانه هشدار" /></div>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت پیگیری"}</button>
      </form><section className="card p-5"><h2 className="font-bold">تاریخچهٔ ایجنت</h2><p className="mt-1 text-xs text-muted">ابزارهای اجراشده و نتیجهٔ آن‌ها؛ جزئیات حساس ذخیره نمی‌شود.</p><ul className="mt-3 space-y-2 text-xs">{actions.map((a) => <li key={a.id} className="flex justify-between gap-2 border-b border-border pb-2"><span dir="ltr">{a.tool}</span><span>{a.result?.ok === false ? "ناموفق" : a.result ? "موفق" : "نامشخص"}</span></li>)}</ul></section></div>
    </div>
  </AppShell>;
}

