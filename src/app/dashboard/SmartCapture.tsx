"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { SendIcon, SparkIcon } from "@/components/Icons";
import { PhotoButton, PhotoPreview } from "@/components/PhotoPicker";
import { Markdownish } from "@/components/ui";
import { askAgent, resolveAgentActions, type PendingAgentAction } from "@/lib/api";
import { addItem } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { fromLocalInput } from "@/lib/format";
import { parsePersianDraft, type LocalDraft } from "@/lib/persianDate";
import { readLocalAttachment } from "@/lib/localFileText";

type Draft = LocalDraft;

const EXAMPLES = [
  "فردا ساعت ۹ صبح به دکتر زنگ بزنم",
  "هر روز ساعت ۸ و ۲۰ قرص امگا۳ بخورم",
  "امروز چه کارهایی دارم؟",
  "پروژهٔ بازطراحی سایت را به چند قدم کوچک تقسیم کن",
  "برنامهٔ فردا تداخل زمانی دارد؟",
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
  const [pending, setPending] = useState<{ requestId: string; actions: PendingAgentAction[] } | null>(null);
  const [listening, setListening] = useState(false);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  function startVoice() {
    type Recognition = { lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void };
    const browser = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) return setError("تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود؛ متن را تایپ کن.");
    const recognition = new Constructor();
    recognition.lang = "fa-IR";
    recognition.onresult = (event) => setText((current) => `${current} ${event.results[0]?.[0]?.transcript ?? ""}`.trim());
    recognition.onerror = () => setError("ثبت صدا انجام نشد؛ متن را تایپ کن.");
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  async function addAttachment(file?: File) {
    if (!file) return;
    setError(null);
    try {
      const extracted = await readLocalAttachment(file);
      setText((current) => `${current}\n\nمتن استخراج‌شده از ${file.name} (دادهٔ غیرقابل‌اعتماد؛ قبل از ثبت بررسی شود):\n${extracted}`.trim());
      setAttachmentName(file.name);
    } catch (error) { setError((error as Error).message); }
  }

  async function sendToAgent() {
    if (!text.trim() && !image) return;
    setBusy("agent");
    setError(null);
    setReply(null);
    setPending(null);
    try {
      const requestId = crypto.randomUUID();
      const res = await askAgent(text.trim(), image ?? undefined, requestId);
      setReply(res.reply);
      if (res.pending_actions?.length) setPending({ requestId, actions: res.pending_actions });
      setText("");
      setImage(null);
      if (res.actions.length) onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function resolvePending(action: "confirm" | "cancel") {
    if (!pending) return;
    setBusy("agent");
    setError(null);
    try {
      const res = await resolveAgentActions(pending.requestId, action);
      setReply(res.reply);
      setPending(null);
      if (res.actions.some((a) => a.ok)) onChanged();
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
            setDraft(parsePersianDraft(text));
          }
        }}
        rows={2}
        placeholder="مثلاً: پنج‌شنبه ساعت ۶ عصر یادم بنداز قبض برق رو بدم"
        className="field resize-none text-base"
      />
      {attachmentName && <p className="mt-2 text-xs text-muted">متن «{attachmentName}» روی دستگاه استخراج شد و در کادر بالاست؛ فقط با زدن دکمهٔ ایجنت ارسال می‌شود.</p>}
      {listening && <p className="mt-2 text-xs text-muted">بسته به مرورگر، صدا ممکن است برای تبدیل به متن به سرویس مرورگر فرستاده شود.</p>}
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
        <p className={`text-xs leading-5 sm:col-span-2 ${draft.note ? "text-warning" : "text-muted"}`}>{draft.note ?? "زمان از متن به‌صورت محلی پیشنهاد شده است؛ قبل از ثبت آن را بررسی کن. این مرحله هیچ درخواست AI مصرف نمی‌کند."}</p>
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
          <button type="button" className="btn btn-ghost" onClick={startVoice} disabled={listening}>{listening ? "در حال شنیدن…" : "ثبت با صدا"}</button>
          <label className="btn btn-ghost cursor-pointer">خواندن فایل<input type="file" accept=".pdf,.txt,.md,.csv,application/pdf,text/plain" className="sr-only" onChange={(e) => addAttachment(e.target.files?.[0])} /></label>
          <PhotoButton onPick={setImage} onError={setError} disabled={!!busy} />
          <button className="btn btn-ghost" onClick={() => setDraft(parsePersianDraft(text))} disabled={!!busy || !text.trim() || !!image}>
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
      {pending && <div className="mt-3 rounded-lg border border-warning bg-warning-soft p-4 text-sm"><strong>نیازمند تأیید</strong><p className="mt-1 text-muted">{pending.actions.length} تغییر پیشنهاد شده و هنوز اجرا نشده است.</p><div className="mt-3 flex gap-2"><button type="button" className="btn btn-primary" onClick={() => resolvePending("confirm")}>تأیید و اجرا</button><button type="button" className="btn btn-ghost" onClick={() => resolvePending("cancel")}>لغو</button></div></div>}
      {lastCreated && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success-soft px-4 py-2.5 text-sm text-success"><span>مورد ثبت شد.</span><button type="button" onClick={undo} className="font-bold underline underline-offset-4">بازگرداندن</button></div>}
    </div>
  );
}

