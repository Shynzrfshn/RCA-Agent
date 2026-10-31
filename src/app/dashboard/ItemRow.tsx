"use client";

import { toggleItem } from "./actions";

const KIND_LABELS: Record<string, string> = {
  task: "کار",
  note: "یادداشت",
  reminder: "یادآوری",
  idea: "ایده",
};

export default function ItemRow({
  id,
  content,
  kind,
  done,
}: {
  id: string;
  content: string;
  kind: string;
  done: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3" dir="rtl">
      <input
        type="checkbox"
        checked={done}
        onChange={(e) => toggleItem(id, e.target.checked)}
        className="mt-1"
      />
      <div className="flex-1">
        <p className={done ? "text-neutral-400 line-through" : ""}>
          {content}
        </p>
        <span className="text-xs text-neutral-500">
          {KIND_LABELS[kind] ?? kind}
        </span>
      </div>
    </li>
  );
}
