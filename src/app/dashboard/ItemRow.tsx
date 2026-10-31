"use client";

import { toggleItem } from "./actions";

export default function ItemRow({
  id,
  content,
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
      <p className={done ? "flex-1 text-neutral-400 line-through" : "flex-1"}>
        {content}
      </p>
    </li>
  );
}
