"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { SendIcon, SparkIcon } from "@/components/Icons";
import { PhotoButton, PhotoPreview } from "@/components/PhotoPicker";
import { Markdownish } from "@/components/ui";
import { askAgent } from "@/lib/api";
import { addItem } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { fromLocalInput, toLocalInput } from "@/lib/format";

type Draft = { content: string; due: string; recurrence: "" | "daily" | "weekly" | "monthly"; priority: number };
const ascii = (s: string) => s.replace(/[۰-۹٠-٩]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(c) % 10));
function draftFromText(input: string): Draft {
  const normalized = ascii(input.trim());
  const date = new Date();
  const tomorrow = /فردا/.test(normalized);
  if (tomorrow) date.setDate(date.getDate() + 1);
  const time = normalized.match(/(?:ساعت\s*)?(\d{1,2})(?::(\d{2}))?\s*(صبح|ظهر|عصر|شب)/);
  const explicit = normalized.match(/ساعت\s*(\d{1,2})(?::(\d{2}))?/);
  const match = time ?? explicit;
  if (match) {
    let h = Number(match[1]);
    const period = time?.[3];
    if ((period === "عصر" || period === "شب" || period === "ظهر") && h < 12) h += 12;
    date.setHours(Math.min(h, 23), Number(match[2] ?? 0), 0, 0);
  }
  return { content: input.trim(), due: tomorrow || match ? toLocalInput(date.toISOString()) : "", recurrence: /هر\s*روز|روزانه/.test(input) ? "daily" : /هر\s*هفته|هفتگی/.test(input) ? "weekly" : /هر\s*ماه|ماهانه/.test(input) ? "monthly" : "", priority: /فوری|اضطراری/.test(input) ? 3 : /مهم/.test(input) ? 2 : 1 };
}

const EXAMPLES = [
  "فردا ساعت ۹ صبح به دکتر زنگ بزنم",
  "هر روز ساعت ۸ و ۲۰ قرص امگا۳ بخورم",
  "امروز چه کارهایی دارم؟",
];

export default function SmartCapture({ onChanged }: { onChanged: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"agent" | "quick" | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  async function sendToAgent() {
    if (!text.trim() && !image) return;
    setBusy("agent");
    setError(null);
    setReply(null);
    try {
      const res = await askAgent(text.trim(), image ?? undefined);
      setReply(res.reply);
      setText("");
      setImage(null);
      if (res.actions.length) onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function quickAdd() {
    if (!draft?.content.trim()) return;
    setBusy("quick");
    setError(null);
    try {
      const { data } = await createClient().auth.getUser();
      if (!data.user) throw new Error("not signed in");
      const id = await addItem(data.user.id, { content: draft.content.trim(), kind: draft.due ? "reminder" : "task", due_at: fromLocalInput(draft.due), recurrence: draft.recurrence || null, priority: draft.priority });
      setLastCreated(id);
      setText("");
      setDraft(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    if (!lastCreated) return;
    const { error } = await createClient().from("items").delete().eq("id", lastCreated);
    if (error) return setError(error.message);
    setLastCreated(null);
    onChanged();
  }

  return (
    <div className="card relative overflow-hidden border-t-[3px] border-t-accent p-4 sm:p-6">
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <SparkIcon width={16} height={16} className="text-accent" />
        ثبت و برنامه‌ریزی سریع
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => { setText(e.target.value); setDraft(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            setDraft(draftFromText(text));
          }
        }}
        rows={2}
        placeholder="مثلاً: پنج‌شنبه ساعت ۶ عصر یادم بنداز قبض برق رو بدم"
        className="field resize-none text-base"
      />
      {image && (
        <div className="mt-3 flex items-center gap-3">
          <PhotoPreview src={image} onRemove={() => setImage(null)} />
          <span className="text-xs text-muted">ایجنت عکس رو می‌خونه و کار لازم رو انجام می‌ده (مثلاً ثبت داروهای نسخه).</span>
        </div>
      )}
      {draft && <div className="mt-4 grid gap-3 rounded-lg border border-accent bg-accent-soft p-4 sm:grid-cols-2" role="group" aria-label="پیش‌نمایش قبل از ثبت">
        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold">متن مورد</label><input className="field" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></div>
        <div><label className="mb-1 block text-xs font-semibold">زمان پیشنهادی</label><input type="datetime-local" className="field" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></div>
        <div><label className="mb-1 block text-xs font-semibold">تکرار</label><select className="field" value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value as Draft["recurrence"] })}><option value="">بدون تکرار</option><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option></select></div>
        <div><label className="mb-1 block text-xs font-semibold">اولویت</label><select className="field" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}><option value="1">عادی</option><option value="2">مهم</option><option value="3">فوری</option></select></div>
        <div className="flex items-end gap-2"><button className="btn btn-primary" disabled={!!busy || !draft.content.trim()} onClick={quickAdd}>تأیید و ثبت</button><button className="btn btn-ghost" onClick={() => setDraft(null)}>انصراف</button></div>
        <p className="text-xs leading-5 text-muted sm:col-span-2">زمان از متن به‌صورت محلی پیشنهاد شده است؛ قبل از ثبت آن را بررسی کن. این مرحله هیچ درخواست AI مصرف نمی‌کند.</p>
      </div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => { setText(ex); setDraft(null); }}
              className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted transition hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <PhotoButton onPick={setImage} onError={setError} disabled={!!busy} />
          <button className="btn btn-ghost" onClick={() => setDraft(draftFromText(text))} disabled={!!busy || !text.trim() || !!image}>
            پیش‌نمایش ثبت
          </button>
          <button className="btn btn-primary" onClick={sendToAgent} disabled={!!busy || (!text.trim() && !image)}>
            <SendIcon width={16} height={16} />
            {busy === "agent" ? "در حال پردازش…" : "گفتگو با ایجنت"}
          </button>
        </div>
      </div>
      {(reply || error) && (
        <div
          role="status"
          className={`animate-rise mt-4 rounded-xl p-3.5 text-sm ${
            error ? "bg-danger-bg text-danger" : "bg-accent-soft"
          }`}
        >
          {error ?? <Markdownish text={reply!} />}
          {reply && (
            <Link href="/chat/" className="mt-2 block text-xs text-accent">
              ادامه‌ی گفتگو ←
            </Link>
          )}
        </div>
      )}
      {lastCreated && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success-soft px-4 py-2.5 text-sm text-success"><span>مورد ثبت شد.</span><button type="button" onClick={undo} className="font-bold underline underline-offset-4">بازگرداندن</button></div>}
    </div>
  );
}
