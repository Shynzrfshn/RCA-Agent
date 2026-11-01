"use client";

import { useId } from "react";
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
  const checkboxId = useId();

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
      <input
        id={checkboxId}
        type="checkbox"
        checked={done}
        onChange={(e) => toggleItem(id, e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
      />
      <label
        htmlFor={checkboxId}
        className={done ? "flex-1 text-muted line-through" : "flex-1"}
      >
        {content}
      </label>
    </li>
  );
}
