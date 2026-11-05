export type ThemeMode = "system" | "light" | "dark";
export type Accent = "violet" | "blue" | "green" | "rose" | "amber";

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "violet", label: "بنفش", swatch: "linear-gradient(135deg,#5b4cf0,#a855f7)" },
  { value: "blue", label: "آبی", swatch: "linear-gradient(135deg,#2563eb,#06b6d4)" },
  { value: "green", label: "سبز", swatch: "linear-gradient(135deg,#059669,#84cc16)" },
  { value: "rose", label: "سرخ", swatch: "linear-gradient(135deg,#e11d48,#f97316)" },
  { value: "amber", label: "کهربایی", swatch: "linear-gradient(135deg,#d97706,#eab308)" },
];

/** Runs before first paint (inlined in <head>) so there is no theme flash. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("rca-theme");var a=localStorage.getItem("rca-accent");var r=document.documentElement;if(t==="light"||t==="dark")r.dataset.theme=t;if(a&&a!=="violet")r.dataset.accent=a;}catch(e){}`;

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export const getTheme = () => read("rca-theme", "system") as ThemeMode;
export const getAccent = () => read("rca-accent", "violet") as Accent;

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme;
  else root.dataset.theme = mode;
  try {
    localStorage.setItem("rca-theme", mode);
  } catch {
    /* storage blocked: still applies for this visit */
  }
}

export function applyAccent(accent: Accent) {
  const root = document.documentElement;
  if (accent === "violet") delete root.dataset.accent;
  else root.dataset.accent = accent;
  try {
    localStorage.setItem("rca-accent", accent);
  } catch {
    /* storage blocked: still applies for this visit */
  }
}
