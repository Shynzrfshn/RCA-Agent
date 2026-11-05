"use client";

import { useEffect, useState } from "react";
import { ACCENTS, applyAccent, applyTheme, getAccent, getTheme, type Accent, type ThemeMode } from "@/lib/theme";

const MODES: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "system", label: "مثل سیستم", icon: "🖥️" },
  { value: "light", label: "روشن", icon: "☀️" },
  { value: "dark", label: "تیره", icon: "🌙" },
];

export default function ThemePicker() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [accent, setAccent] = useState<Accent>("violet");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved choice after mount
    setMode(getTheme());
    setAccent(getAccent());
  }, []);

  return (
    <div className="card space-y-5 p-5">
      <fieldset>
        <legend className="mb-2 text-xs text-muted">حالت نمایش</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => {
                setMode(m.value);
                applyTheme(m.value);
              }}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm transition ${
                mode === m.value ? "border-accent bg-accent-soft font-semibold" : "border-border hover:border-muted"
              }`}
            >
              <span className="text-xl" aria-hidden>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs text-muted">رنگ اصلی</legend>
        <div role="radiogroup" className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={accent === a.value}
              aria-label={a.label}
              title={a.label}
              onClick={() => {
                setAccent(a.value);
                applyAccent(a.value);
              }}
              className={`size-10 rounded-full transition ${
                accent === a.value ? "ring-2 ring-ring ring-offset-2 ring-offset-surface scale-110" : "hover:scale-105"
              }`}
              style={{ background: a.swatch }}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
