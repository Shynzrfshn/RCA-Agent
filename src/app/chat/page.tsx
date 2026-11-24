"use client";

import { useEffect, useId, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { LogoMark, SendIcon, TrashIcon } from "@/components/Icons";
import { PhotoButton, PhotoPreview } from "@/components/PhotoPicker";
import { ErrorNote, Markdownish } from "@/components/ui";
import { askAgent, resolveAgentActions, type PendingAgentAction } from "@/lib/api";
import { faTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "امروز چی دارم؟",
  "ایمیل‌های مهم این هفته رو خلاصه کن",
  "پایبندی دارویی‌ام این دو هفته چطور بوده؟",
  "برای فردا یه برنامه‌ی روزانه بچین",
];
const TOOL_LABELS: Record<string, string> = { create_item: "ثبت کار", update_item: "ویرایش کار", complete_item: "تکمیل کار", add_medication: "ثبت دارو", search_emails: "جست‌وجوی ایمیل", get_overview: "بررسی برنامه", remember: "ثبت در حافظه" };
type Attempt = { msg: string; photo: string | null; requestId: string };
type Pending = { requestId: string; actions: PendingAgentAction[] };

export default function ChatPage() {
  const supabase = createClient();
  const inputId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [actionLog, setActionLog] = useState<{ tool: string; ok: boolean }[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("agent_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => setMessages(((data as ChatMessage[]) ?? []).reverse()));
  }, [supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(content: string, retry?: Attempt) {
    const msg = retry?.msg ?? content.trim();
    const photo = retry?.photo ?? image;
    if ((!msg && !photo) || busy) return;
    const requestId = retry?.requestId ?? crypto.randomUUID();
    setText("");
    setImage(null);
    setError(null);
    setActionLog([]);
    setPending(null);
    setBusy(true);
    const now = new Date().toISOString();
    if (!retry) setMessages((m) => [ ...m, { id: `local-${now}`, role: "user", content: photo ? `[تصویر] ${msg}`.trim() : msg, created_at: now } ]);
    try {
      const res = await askAgent(msg, photo ?? undefined, requestId);
      setActionLog(res.actions);
      if (res.pending_actions?.length) setPending({ requestId, actions: res.pending_actions });
      setLastAttempt(null);
      setMessages((m) => [
        ...m,
        { id: `reply-${Date.now()}`, role: "assistant", content: res.reply, created_at: new Date().toISOString() },
      ]);
    } catch (e) {
      setError((e as Error).message);
      setLastAttempt({ msg, photo, requestId });
    } finally {
      setBusy(false);
    }
  }

  async function resolvePending(action: "confirm" | "cancel") {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await resolveAgentActions(pending.requestId, action);
      setActionLog(res.actions);
      setMessages((m) => [...m, { id: `resolution-${Date.now()}`, role: "assistant", content: res.reply, created_at: new Date().toISOString() }]);
      setPending(null);
    } catch (e) {
      setError((e as Error).message === "request_failed_use_new_id"
        ? "نتیجهٔ اقدام قبلی قطعی نیست. ابتدا وضعیت کارها و داروها را بررسی کن، سپس درخواست تازه بفرست."
        : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirm("کل تاریخچه‌ی گفتگو پاک بشه؟")) return;
    const { data } = await supabase.auth.getUser();
    await supabase.from("agent_messages").delete().eq("user_id", data.user!.id);
    setMessages([]);
  }

  return (
    <AppShell
      title="گفتگو با ایجنت"
      subtitle="کار بساز، دارو ثبت کن، ایمیل‌ها رو بپرس — به زبان خودت"
      action={
        messages.length > 0 && (
          <button onClick={clear} className="btn btn-ghost px-2.5" aria-label="پاک کردن تاریخچه">
            <TrashIcon width={16} height={16} />
          </button>
        )
      }
    >
      <div className="flex min-h-[calc(100vh-14rem)] flex-col">
        <div className="flex-1 space-y-4 pb-4" aria-live="polite">
          {messages.length === 0 && !busy && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <LogoMark width={56} height={56} />
              <p className="max-w-sm text-sm leading-7 text-muted">
                سلام! من RCA هستم. هر چی لازم داری بگو؛ به کارها، داروها و ایمیل‌هات دسترسی دارم.
              </p>
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:border-accent hover:text-accent">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`animate-rise flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${
                  m.role === "user"
                    ? "rounded-tr-md bg-accent text-accent-foreground"
                    : "card rounded-tl-md"
                }`}
              >
                {m.role === "assistant" ? <Markdownish text={m.content} /> : <p className="whitespace-pre-wrap leading-7">{m.content}</p>}
                <div className={`mt-1 text-[10px] ${m.role === "user" ? "opacity-70" : "text-muted"}`}>{faTime(m.created_at)}</div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-end">
              <div className="card typing flex gap-1 rounded-2xl rounded-tl-md px-4 py-3.5" role="status" aria-label="در حال نوشتن">
                <span className="size-2 rounded-full bg-muted" />
                <span className="size-2 rounded-full bg-muted" />
                <span className="size-2 rounded-full bg-muted" />
              </div>
            </div>
          )}
          {actionLog.length > 0 && <div className="card mr-auto max-w-lg p-4 text-sm" role="status"><div className="mb-2 font-semibold">اقدام‌های این پاسخ</div><ul className="space-y-1.5">{actionLog.map((a, i) => <li key={`${a.tool}-${i}`} className="flex items-center justify-between gap-4"><span>{TOOL_LABELS[a.tool] ?? a.tool.replaceAll("_", " ")}</span><span className={a.ok ? "text-success" : "text-danger"}>{a.ok ? "انجام شد" : "ناموفق"}</span></li>)}</ul></div>}
          {pending && <div className="card mr-auto max-w-lg border-r-[3px] border-r-warning p-4 text-sm" role="alert"><div className="font-bold">تأیید پیش از اجرا</div><p className="mt-1 leading-6 text-muted">ایجنت این تغییرها را پیشنهاد داده است. تا وقتی تأیید نکنی هیچ‌کدام اجرا نمی‌شوند.</p><ul className="my-3 space-y-2">{pending.actions.map((a, i) => <li key={`${a.tool}-${i}`} className="rounded-lg bg-surface-2 p-3"><strong>{TOOL_LABELS[a.tool] ?? a.tool.replaceAll("_", " ")}</strong><pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-muted" dir="auto">{JSON.stringify(a.input, null, 2)}</pre></li>)}</ul><div className="flex gap-2"><button type="button" className="btn btn-primary" onClick={() => resolvePending("confirm")}>تأیید و اجرا</button><button type="button" className="btn btn-ghost" onClick={() => resolvePending("cancel")}>لغو</button></div></div>}
          {error && <div><ErrorNote>{error}</ErrorNote>{lastAttempt && <button type="button" className="btn btn-ghost mt-2" onClick={() => send(lastAttempt.msg, lastAttempt)}>تلاش دوباره</button>}</div>}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="card sticky bottom-20 flex flex-wrap items-end gap-2 p-2 md:bottom-6"
        >
          {image && (
            <div className="w-full p-1">
              <PhotoPreview src={image} onRemove={() => setImage(null)} />
            </div>
          )}
          <PhotoButton onPick={setImage} onError={setError} disabled={busy} className="btn btn-ghost size-11 shrink-0 p-0" />
          <label htmlFor={inputId} className="sr-only">پیام</label>
          <textarea
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={1}
            placeholder="پیامت رو بنویس…"
            className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 outline-none"
          />
          <button type="submit" disabled={busy || (!text.trim() && !image)} className="btn btn-primary size-11 shrink-0 p-0" aria-label="ارسال">
            <SendIcon width={18} height={18} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}

