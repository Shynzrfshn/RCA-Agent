"use client";

import { useId, type ReactNode } from "react";
import { toFa } from "@/lib/format";

export function ProgressRing({
  value,
  total,
  size = 88,
  label,
}: {
  value: number;
  total: number;
  size?: number;
  label?: string;
}) {
  const gid = `ring${useId().replace(/:/g, "")}`;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold">
          {toFa(value)}/{toFa(total)}
        </span>
        {label && <span className="text-[10px] text-muted">{label}</span>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "accent",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "accent" | "success" | "warning" | "danger";
  icon?: ReactNode;
}) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-bg text-danger",
  };
  return (
    <div className="card animate-rise flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {icon && <span className={`rounded-lg p-1.5 ${tones[tone]}`}>{icon}</span>}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Very small, safe markdown: **bold**, bullet lists and paragraphs. */
export function Markdownish({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2 leading-7">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pr-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(block.replace(/^#+\s*/gm, ""))}
          </p>
        );
      })}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}
