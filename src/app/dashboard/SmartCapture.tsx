"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { SendIcon, SparkIcon } from "@/components/Icons";
import { PhotoButton, PhotoPreview } from "@/components/PhotoPicker";
import { Markdownish } from "@/components/ui";
import { askAgent } from "@/lib/api";
import { addItem } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";

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
    if (!text.trim()) return;
    setBusy("quick");
    setError(null);
    try {
      const { data } = await createClient().auth.getUser();
      if (!data.user) throw new Error("not signed in");
      await addItem(data.user.id, { content: text.trim(), kind: "task" });
      setText("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <div className="gradient-accent pointer-events-none absolute -top-24 -right-24 size-56 rounded-full opacity-15 blur-3xl" />
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <SparkIcon width={16} height={16} className="text-accent" />
        به ایجنت بگو
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendToAgent();
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted transition hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <PhotoButton onPick={setImage} onError={setError} disabled={!!busy} />
          <button className="btn btn-ghost" onClick={quickAdd} disabled={!!busy || !text.trim() || !!image}>
            {busy === "quick" ? "…" : "ثبت سریع"}
          </button>
          <button className="btn btn-primary" onClick={sendToAgent} disabled={!!busy || (!text.trim() && !image)}>
            <SendIcon width={16} height={16} />
            {busy === "agent" ? "در حال فکر کردن…" : "بسپار به ایجنت"}
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
    </div>
  );
}
