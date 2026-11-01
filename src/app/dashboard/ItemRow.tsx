"use client";

import { useId } from "react";

export default function ItemRow({
  content,
  done,
  onToggle,
}: {
  content: string;
  done: boolean;
  onToggle: (done: boolean) => void;
}) {
  const checkboxId = useId();

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
      <input
        id={checkboxId}
        type="checkbox"
        checked={done}
        onChange={(e) => onToggle(e.target.checked)}
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
