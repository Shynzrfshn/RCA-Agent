/** Local calendar parts for a timezone, e.g. for "is it 7am in Tehran?". */
export function localParts(tz: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday as string,
  };
}

/** Human-readable Persian date/time, Jalali calendar. */
export function faDateTime(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function faTime(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** UTC bounds of the user's local "today". */
export function localDayBounds(tz: string, at = new Date()): { start: Date; end: Date } {
  const { date } = localParts(tz, at);
  // Offset of tz at this moment, in minutes.
  const asLocal = new Date(
    new Date(at.toLocaleString("en-US", { timeZone: tz })).getTime(),
  );
  const asUtc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = asLocal.getTime() - asUtc.getTime();
  const start = new Date(new Date(`${date}T00:00:00Z`).getTime() - offsetMs);
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}
