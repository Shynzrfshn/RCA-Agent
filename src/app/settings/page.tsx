"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import AppShell from "@/components/AppShell";
import { BellIcon, MailIcon, SparkIcon, TrashIcon } from "@/components/Icons";
import { ErrorNote, Section } from "@/components/ui";
import { callFunction } from "@/lib/api";
import { relative, toFa } from "@/lib/format";
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupported,
  testNotification,
} from "@/lib/push";
import { createClient } from "@/lib/supabase/client";
import type { EmailAccount, Profile } from "@/lib/types";
import ThemePicker from "./ThemePicker";

const TIMEZONES = [
  "Asia/Tehran",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
  "America/Toronto",
  "America/Los_Angeles",
  "Australia/Sydney",
];

const GMAIL_STATUS: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "جیمیل با موفقیت وصل شد. اولین همگام‌سازی چند دقیقه طول می‌کشه." },
  denied: { ok: false, text: "دسترسی به جیمیل رد شد." },
  invalid: { ok: false, text: "لینک اتصال نامعتبر یا منقضی بود. دوباره امتحان کن." },
  no_refresh_token: { ok: false, text: "گوگل توکن دائمی نداد. از myaccount.google.com دسترسی قبلی رو حذف کن و دوباره وصل شو." },
  error: { ok: false, text: "اتصال جیمیل با خطا مواجه شد." },
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const ids = { name: useId(), tz: useId(), hour: useId() };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [memories, setMemories] = useState<{ id: string; content: string }[]>([]);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, a, m] = await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase.from("email_accounts").select("id, email, last_synced_at, last_error"),
      supabase.from("memories").select("id, content").order("created_at"),
    ]);
    if (p.error) setError(p.error.message);
    const { data: u } = await supabase.auth.getUser();
    setProfile(
      (p.data as Profile) ?? {
        user_id: u.user!.id,
        display_name: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran",
        briefing_hour: 7,
        briefing_enabled: true,
        evening_hour: 21,
        evening_enabled: true,
        weekly_day: 5,
        nudges_enabled: true,
      },
    );
    setAccounts((a.data as EmailAccount[]) ?? []);
    setMemories(m.data ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
    const status = new URLSearchParams(window.location.search).get("gmail");
    if (status && GMAIL_STATUS[status]) {
      setNotice(GMAIL_STATUS[status]);
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (pushSupported()) currentSubscription().then((s) => setPushOn(!!s), () => setPushOn(false));
    else setPushOn(false);
  }, [load]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    const { error } = await supabase.from("profiles").upsert(profile);
    if (error) return setError(error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function togglePush() {
    setBusy("push");
    setError(null);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
      } else {
        await enablePush();
        setPushOn(true);
        await testNotification();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function connectGmail() {
    setBusy("gmail");
    setError(null);
    try {
      const { url } = await callFunction<{ url: string }>("gmail-auth");
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function disconnect(a: EmailAccount) {
    if (!confirm(`اتصال ${a.email} و ایمیل‌های ذخیره‌شده‌اش حذف بشه؟`)) return;
    const { error } = await supabase.from("email_accounts").delete().eq("id", a.id);
    if (error) setError(error.message);
    load();
  }

  async function forget(id: string) {
    setMemories((m) => m.filter((x) => x.id !== id));
    await supabase.from("memories").delete().eq("id", id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login/");
  }

  return (
    <AppShell title="تنظیمات">
      <div className="max-w-2xl space-y-8 pb-6">
        {notice && (
          <p role="status" className={`rounded-xl p-3 text-sm ${notice.ok ? "bg-success-soft text-success" : "bg-danger-bg text-danger"}`}>
            {notice.text}
          </p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}

        <Section title="پروفایل و ایجنت پیش‌دستانه">
          {profile && (
            <form onSubmit={saveProfile} className="card space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={ids.name} className="mb-1 block text-xs text-muted">اسمت (برای ایجنت)</label>
                  <input
                    id={ids.name}
                    className="field"
                    value={profile.display_name ?? ""}
                    onChange={(e) => setProfile({ ...profile, display_name: e.target.value || null })}
                  />
                </div>
                <div>
                  <label htmlFor={ids.tz} className="mb-1 block text-xs text-muted">منطقه‌ی زمانی</label>
                  <select
                    id={ids.tz}
                    className="field"
                    dir="ltr"
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  >
                    {[...new Set([profile.timezone, ...TIMEZONES])].map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.briefing_enabled}
                    onChange={(e) => setProfile({ ...profile, briefing_enabled: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  خلاصه‌ی روزانه بفرست، ساعت
                </label>
                <label htmlFor={ids.hour} className="sr-only">ساعت خلاصه</label>
                <select
                  id={ids.hour}
                  className="field w-24 py-1.5"
                  value={profile.briefing_hour}
                  onChange={(e) => setProfile({ ...profile, briefing_hour: Number(e.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{toFa(h)}:۰۰</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.evening_enabled ?? true}
                    onChange={(e) => setProfile({ ...profile, evening_enabled: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  مرور شب و برنامه‌ی فردا، ساعت
                </label>
                <label htmlFor={`${ids.hour}-eve`} className="sr-only">ساعت مرور شب</label>
                <select
                  id={`${ids.hour}-eve`}
                  className="field w-24 py-1.5"
                  value={profile.evening_hour ?? 21}
                  onChange={(e) => setProfile({ ...profile, evening_hour: Number(e.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{toFa(h)}:۰۰</option>
                  ))}
                </select>
                <label htmlFor={`${ids.hour}-wk`} className="text-sm">مرور هفتگی</label>
                <select
                  id={`${ids.hour}-wk`}
                  className="field w-28 py-1.5"
                  value={profile.weekly_day ?? 5}
                  onChange={(e) => setProfile({ ...profile, weekly_day: Number(e.target.value) })}
                >
                  {["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"].map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.nudges_enabled ?? true}
                  onChange={(e) => setProfile({ ...profile, nudges_enabled: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                ایجنت خودش پیشنهاد بده (کار عقب‌افتاده، دوز جامونده، ایمیل فوری؛ حداکثر ۲ بار در روز)
              </label>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">{saved ? "ذخیره شد ✓" : "ذخیره"}</button>
              </div>
            </form>
          )}
        </Section>

        <Section title="ظاهر">
          <ThemePicker />
        </Section>

        <Section title="اعلان‌ها">
          <div className="card flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <BellIcon />
            </span>
            <div className="min-w-0 flex-1 text-sm leading-6">
              <div className="font-semibold">اعلان یادآوری و دارو</div>
              <div className="text-muted">
                {pushOn === null
                  ? "…"
                  : !pushSupported()
                    ? "این مرورگر پشتیبانی نمی‌کنه. روی آیفون، اول اپ رو به صفحه‌ی اصلی اضافه کن."
                    : pushOn
                      ? "روی این دستگاه فعاله."
                      : "خاموشه. برای یادآور دارو حتماً روشنش کن."}
              </div>
            </div>
            {pushSupported() && (
              <button onClick={togglePush} disabled={busy === "push"} className={`btn ${pushOn ? "btn-ghost" : "btn-primary"}`}>
                {busy === "push" ? "…" : pushOn ? "خاموش" : "روشن کن"}
              </button>
            )}
          </div>
        </Section>

        <Section title="حساب‌های ایمیل">
          <div className="card divide-y divide-border">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-4">
                <MailIcon className="text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" dir="ltr">{a.email}</div>
                  <div className={`text-xs ${a.last_error ? "text-danger" : "text-muted"}`}>
                    {a.last_error
                      ? `خطا: ${a.last_error}`
                      : a.last_synced_at
                        ? `آخرین همگام‌سازی ${relative(a.last_synced_at)}`
                        : "در انتظار اولین همگام‌سازی"}
                  </div>
                </div>
                <button onClick={() => disconnect(a)} aria-label={`قطع ${a.email}`} className="rounded-lg p-1.5 text-muted hover:bg-danger-bg hover:text-danger">
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 p-4">
              <p className="text-xs leading-5 text-muted">دسترسی فقط خواندنی؛ توکن رمزنگاری‌شده ذخیره می‌شه.</p>
              <button onClick={connectGmail} disabled={busy === "gmail"} className="btn btn-primary shrink-0">
                {busy === "gmail" ? "…" : "اتصال Gmail"}
              </button>
            </div>
          </div>
        </Section>

        <Section title="حافظه‌ی ایجنت">
          <div className="card p-4">
            {memories.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <SparkIcon width={16} height={16} />
                ایجنت هنوز چیزی درباره‌ات یاد نگرفته. توی گفتگو بهش بگو «یادت باشه…».
              </p>
            ) : (
              <ul className="space-y-2">
                {memories.map((m) => (
                  <li key={m.id} className="flex items-start gap-2 rounded-lg bg-surface-2 p-2.5 text-sm">
                    <span className="flex-1">{m.content}</span>
                    <button onClick={() => forget(m.id)} aria-label="فراموش کن" className="text-muted hover:text-danger">
                      <TrashIcon width={14} height={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        <button onClick={signOut} className="btn btn-ghost w-full text-danger">خروج از حساب</button>
      </div>
    </AppShell>
  );
}
