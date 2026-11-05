const faNum = new Intl.NumberFormat("fa-IR");

export const toFa = (n: number) => faNum.format(n);

export function faTime(iso: string) {
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function faDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...opts,
  }).format(new Date(iso));
}

/** "امروز ۱۴:۳۰", "فردا ۰۹:۰۰", or a Jalali date for anything further out. */
export function faWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const dayDiff = Math.round(
    (new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000,
  );
  const time = faTime(iso);
  if (dayDiff === 0) return `امروز ${time}`;
  if (dayDiff === 1) return `فردا ${time}`;
  if (dayDiff === -1) return `دیروز ${time}`;
  return `${faDate(iso, { weekday: "short" })} ${time}`;
}

export function relative(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 60000;
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), "minute");
  if (Math.abs(diff) < 60 * 24) return rtf.format(Math.round(diff / 60), "hour");
  return rtf.format(Math.round(diff / 1440), "day");
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "ظهر بخیر";
  if (h < 21) return "عصر بخیر";
  return "شب بخیر";
}

/** Value for <input type="datetime-local"> from an ISO string, in local time. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
