"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { MailIcon, RefreshIcon, SearchIcon } from "@/components/Icons";
import { Empty, ErrorNote, Section } from "@/components/ui";
import { callFunction } from "@/lib/api";
import { relative, toFa } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Email, EmailAccount } from "@/lib/types";

const CATS: { key: Email["category"]; label: string; cls: string }[] = [
  { key: "urgent", label: "فوری", cls: "bg-danger-bg text-danger" },
  { key: "important", label: "مهم", cls: "bg-warning-soft text-warning" },
  { key: "normal", label: "عادی", cls: "bg-accent-soft text-accent" },
  { key: "promo", label: "تبلیغاتی", cls: "bg-surface-2 text-muted" },
  { key: "spam", label: "اسپم", cls: "bg-surface-2 text-muted" },
];
const PAGE_SIZE = 50;

export default function InboxPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<EmailAccount[] | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showLow, setShowLow] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [taskDone, setTaskDone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    let emailQuery = supabase
      .from("emails")
      .select("id, account_id, provider_id, from_addr, subject, snippet, summary, category, action_needed, is_read, received_at", { count: "exact" })
      .order("received_at", { ascending: false });
    const term = search.trim().replace(/[%_,()]/g, " ");
    if (term) emailQuery = emailQuery.or(`subject.ilike.%${term}%,from_addr.ilike.%${term}%,summary.ilike.%${term}%`);
    const countQueries = CATS.map((cat) => supabase.from("emails").select("id", { count: "exact", head: true }).eq("category", cat.key).eq("is_read", false));
    const [acc, em, ...categoryCounts] = await Promise.all([
      supabase.from("email_accounts").select("id, email, last_synced_at, last_error"),
      emailQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
      ...countQueries,
    ]);
    if (acc.error) setError(acc.error.message);
    setAccounts((acc.data as EmailAccount[]) ?? []);
    setEmails((em.data as Email[]) ?? []);
    setTotal(em.count ?? 0);
    setCounts(Object.fromEntries(CATS.map((cat, index) => [cat.key, categoryCounts[index]?.count ?? 0])));
    const ref = new URLSearchParams(window.location.search).get("ref");
    const target = (em.data as Email[] | null)?.find((e) => `${e.account_id}:${e.provider_id}` === ref);
    if (target) setExpanded(target.id);
  }, [supabase, search, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      await callFunction("gmail-sync");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function markRead(e: Email) {
    setEmails((prev) => prev.map((x) => (x.id === e.id ? { ...x, is_read: true } : x)));
    setExpanded((prev) => prev === e.id ? null : e.id);
    const { error } = await supabase.from("emails").update({ is_read: true }).eq("id", e.id);
    if (error) setError(error.message);
  }

  async function makeTask(e: Email) {
    setError(null);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setError("برای ساخت کار باید وارد حساب شوید.");
    const source_ref = `${e.account_id}:${e.provider_id}`;
    const { error } = await supabase.from("items").upsert({ user_id: data.user.id, kind: "task", content: e.subject || e.summary || "پیگیری ایمیل", source: "email", source_ref, priority: e.category === "urgent" ? 3 : 2 }, { onConflict: "user_id,source,source_ref", ignoreDuplicates: true });
    if (error) setError(error.message);
    else setTaskDone(e.id);
  }

  const visibleCats = CATS.filter((c) => showLow || !["promo", "spam"].includes(c.key));

  return (
    <AppShell
      title="صندوق ورودی هوشمند"
      subtitle="ایجنت ایمیل‌ها رو می‌خونه، خلاصه و دسته‌بندی می‌کنه، و کارهای لازم رو استخراج می‌کنه"
      action={
        accounts?.length ? (
          <button className="btn btn-ghost" onClick={sync} disabled={syncing}>
            <RefreshIcon width={16} height={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "در حال همگام‌سازی…" : "همگام‌سازی"}
          </button>
        ) : null
      }
    >
      <div className="space-y-6">
        {error && <ErrorNote>{error}</ErrorNote>}

        {accounts !== null && accounts.length === 0 && (
          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <span className="gradient-accent grid size-14 place-items-center rounded-2xl text-white">
              <MailIcon width={26} height={26} />
            </span>
            <h2 className="text-lg font-bold">جیمیلت رو وصل کن</h2>
            <p className="max-w-sm text-sm leading-6 text-muted">
              دسترسی فقط خواندنیه. ایجنت هیچ‌وقت از طرف تو ایمیل نمی‌فرسته.
            </p>
            <Link href="/settings/" className="btn btn-primary">رفتن به تنظیمات</Link>
          </div>
        )}

        {!!accounts?.length && (
          <>
            <label className="relative block"><SearchIcon width={17} height={17} className="absolute right-3 top-3.5 text-muted" /><span className="sr-only">جست‌وجوی ایمیل‌ها</span><input className="field pr-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="جست‌وجو در موضوع، فرستنده و خلاصه" /></label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <span key={a.id} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted" dir="ltr">
                  {a.email}
                  {a.last_synced_at && <span dir="rtl"> · {relative(a.last_synced_at)}</span>}
                  {a.last_error && <span className="text-danger"> · error</span>}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {CATS.map((c) => (
                <div key={c.key} className={`rounded-2xl p-3 ${c.cls}`}>
                  <div className="text-xs">{c.label}</div>
                  <div className="text-xl font-bold">{toFa(counts[c.key] ?? 0)}</div>
                </div>
              ))}
            </div>

            {emails.length === 0 ? (
              <Empty>{search ? "ایمیلی با این عبارت پیدا نشد." : "هنوز ایمیلی همگام نشده. «همگام‌سازی» رو بزن."}</Empty>
            ) : (
              visibleCats.map((c) => {
                const list = emails.filter((e) => e.category === c.key);
                if (!list.length) return null;
                return (
                  <Section key={c.key} title={`${c.label} (${toFa(list.length)})`}>
                    <ul className="card divide-y divide-border overflow-hidden">
                      {list.map((e) => (
                        <li key={e.id} id={`email-${e.id}`} className={expanded === e.id ? "bg-accent-soft/40" : ""}>
                          <button
                            onClick={() => markRead(e)}
                            aria-expanded={expanded === e.id}
                            className={`block w-full p-3.5 text-right transition hover:bg-surface-2 ${e.is_read ? "opacity-80" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              {!e.is_read && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="خوانده نشده" />}
                              <span className="truncate text-sm font-semibold">{e.subject || "(بدون موضوع)"}</span>
                              {e.action_needed && (
                                <span className="shrink-0 rounded bg-danger-bg px-1.5 py-0.5 text-[10px] text-danger">نیاز به اقدام</span>
                              )}
                              <span className="mr-auto shrink-0 text-[11px] text-muted">
                                {e.received_at && relative(e.received_at)}
                              </span>
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted" dir="auto">
                              {e.from_addr?.replace(/<.*>/, "").trim()}
                            </div>
                            <p className="mt-1.5 text-sm leading-6">{e.summary ?? e.snippet}</p>
                          </button>
                          {expanded === e.id && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3 text-sm">
                            <span className="max-w-xl leading-6 text-muted">{e.action_needed ? "این پیام نیازمند پیگیری تشخیص داده شده است. پیش از ساخت کار، موضوع و خلاصه را بررسی کن." : "در صورت نیاز می‌توانی پیگیری این پیام را به کارها اضافه کنی."}</span>
                            <button type="button" onClick={() => makeTask(e)} className="btn btn-ghost text-xs">{taskDone === e.id ? "در کارها ثبت شد" : "ساخت کار از ایمیل"}</button>
                          </div>}
                        </li>
                      ))}
                    </ul>
                  </Section>
                );
              })
            )}
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={showLow} onChange={(e) => setShowLow(e.target.checked)} className="accent-[var(--accent)]" />
              نمایش تبلیغاتی و اسپم
            </label>
            {total > PAGE_SIZE && <nav className="flex items-center justify-center gap-3" aria-label="صفحه‌بندی ایمیل‌ها"><button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>صفحهٔ قبل</button><span className="text-sm text-muted">{toFa((page - 1) * PAGE_SIZE + 1)} تا {toFa(Math.min(page * PAGE_SIZE, total))} از {toFa(total)}</span><button className="btn btn-ghost" disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>صفحهٔ بعد</button></nav>}
          </>
        )}
      </div>
    </AppShell>
  );
}

