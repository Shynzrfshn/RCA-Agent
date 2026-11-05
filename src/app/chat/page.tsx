"use client";

import { useEffect, useId, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { LogoMark, SendIcon, TrashIcon } from "@/components/Icons";
import { ErrorNote, Markdownish } from "@/components/ui";
import { askAgent } from "@/lib/api";
import { faTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "امروز چی دارم؟",
  "ایمیل‌های مهم این هفته رو خلاصه کن",
  "پایبندی دارویی‌ام این دو هفته چطور بوده؟",
  "برای فردا یه برنامه‌ی روزانه بچین",
];

export default function ChatPage() {
  const supabase = createClient();
  const inputId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function send(content: string) {
    const msg = content.trim();
    if (!msg || busy) return;
    setText("");
    setError(null);
    setBusy(true);
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: `local-${now}`, role: "user", content: msg, created_at: now }]);
    try {
      const res = await askAgent(msg);
      setMessages((m) => [
        ...m,
        { id: `reply-${Date.now()}`, role: "assistant", content: res.reply, created_at: new Date().toISOString() },
      ]);
    } catch (e) {
      setError((e as Error).message);
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
          {error && <ErrorNote>{error}</ErrorNote>}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="card sticky bottom-20 flex items-end gap-2 p-2 md:bottom-6"
        >
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
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 outline-none"
          />
          <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary size-11 shrink-0 p-0" aria-label="ارسال">
            <SendIcon width={18} height={18} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
