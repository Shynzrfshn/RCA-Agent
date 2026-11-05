"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { MailIcon, RefreshIcon } from "@/components/Icons";
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

export default function InboxPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<EmailAccount[] | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showLow, setShowLow] = useState(false);

  const load = useCallback(async () => {
    const [acc, em] = await Promise.all([
      supabase.from("email_accounts").select("id, email, last_synced_at, last_error"),
      supabase
        .from("emails")
        .select("id, from_addr, subject, snippet, summary, category, action_needed, is_read, received_at")
        .order("received_at", { ascending: false })
        .limit(150),
    ]);
    if (acc.error) setError(acc.error.message);
    setAccounts((acc.data as EmailAccount[]) ?? []);
    setEmails((em.data as Email[]) ?? []);
  }, [supabase]);

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
    await supabase.from("emails").update({ is_read: true }).eq("id", e.id);
  }

  const counts = Object.fromEntries(
    CATS.map((c) => [c.key, emails.filter((e) => e.category === c.key && !e.is_read).length]),
  );
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
              <Empty>هنوز ایمیلی همگام نشده. «همگام‌سازی» رو بزن.</Empty>
            ) : (
              visibleCats.map((c) => {
                const list = emails.filter((e) => e.category === c.key);
                if (!list.length) return null;
                return (
                  <Section key={c.key} title={`${c.label} (${toFa(list.length)})`}>
                    <ul className="card divide-y divide-border overflow-hidden">
                      {list.map((e) => (
                        <li key={e.id}>
                          <button
                            onClick={() => markRead(e)}
                            className={`block w-full p-3.5 text-right transition hover:bg-surface-2 ${e.is_read ? "opacity-60" : ""}`}
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
          </>
        )}
      </div>
    </AppShell>
  );
}
