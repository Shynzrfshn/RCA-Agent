"use client";

import { useId, useRef, useState } from "react";

const KINDS = [
  { value: "task", label: "کار" },
  { value: "reminder", label: "یادآوری" },
  { value: "note", label: "یادداشت" },
  { value: "idea", label: "ایده" },
];

export default function QuickCapture({
  onAdd,
}: {
  onAdd: (content: string, kind: string) => Promise<void>;
}) {
  const contentId = useId();
  const kindId = useId();
  const [kind, setKind] = useState("task");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    const content = formData.get("content") as string;
    if (!content.trim()) return;
    setPending(true);
    await onAdd(content, kind);
    setPending(false);
    formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
    >
      <label htmlFor={contentId} className="sr-only">
        هر چی به ذهنت رسید بنویس
      </label>
      <textarea
        id={contentId}
        name="content"
        required
        placeholder="هر چی به ذهنت رسید بنویس..."
        className="w-full resize-none rounded-lg border border-border bg-background p-3 text-right outline-none focus-visible:ring-2 focus-visible:ring-ring"
        rows={2}
      />
      <div className="flex items-center justify-between gap-2">
        <div>
          <label htmlFor={kindId} className="sr-only">
            نوع
          </label>
          <select
            id={kindId}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {pending ? "در حال ثبت..." : "ثبت"}
        </button>
      </div>
    </form>
  );
}
