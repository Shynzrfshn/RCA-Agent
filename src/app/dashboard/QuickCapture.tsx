"use client";

import { useRef, useState } from "react";
import { addItem } from "./actions";

const KINDS = [
  { value: "task", label: "کار" },
  { value: "note", label: "یادداشت" },
  { value: "reminder", label: "یادآوری" },
  { value: "idea", label: "ایده" },
];

export default function QuickCapture() {
  const [kind, setKind] = useState("task");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    const content = formData.get("content") as string;
    if (!content.trim()) return;
    setPending(true);
    await addItem(content, kind);
    setPending(false);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3" dir="rtl">
      <textarea
        name="content"
        required
        placeholder="هر چی به ذهنت رسید بنویس..."
        className="w-full rounded-lg border p-3 text-right"
        rows={2}
      />
      <div className="flex items-center justify-between gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-lg border px-3 py-2"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "در حال ثبت..." : "ثبت"}
        </button>
      </div>
    </form>
  );
}
