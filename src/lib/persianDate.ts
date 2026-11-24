const toLocalInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export type LocalDraft = {
  content: string;
  due: string;
  recurrence: "" | "daily" | "weekly" | "monthly";
  priority: number;
  note?: string;
};

const WEEKDAYS: Record<string, number> = {
  "یکشنبه": 0, "دوشنبه": 1, "سه‌شنبه": 2, "چهارشنبه": 3,
  "پنجشنبه": 4, "پنج‌شنبه": 4, "جمعه": 5, "شنبه": 6,
};

export const asciiDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (char) => {
  const fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(char);
  return String(fa >= 0 ? fa : "٠١٢٣٤٥٦٧٨٩".indexOf(char));
});

export function parsePersianDraft(input: string, now = new Date()): LocalDraft {
  const normalized = asciiDigits(input.trim()).replace(/ي/g, "ی").replace(/ك/g, "ک");
  const date = new Date(now);
  let hasDate = false;
  let note: string | undefined;

  if (/پس[‌\s-]?فردا/.test(normalized)) {
    date.setDate(date.getDate() + 2);
    hasDate = true;
  } else if (/فردا/.test(normalized)) {
    date.setDate(date.getDate() + 1);
    hasDate = true;
  } else if (/امروز|امشب/.test(normalized)) {
    hasDate = true;
  } else {
    const weekday = Object.entries(WEEKDAYS).find(([label]) => normalized.includes(label));
    if (weekday) {
      let delta = (weekday[1] - date.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      date.setDate(date.getDate() + delta);
      hasDate = true;
    }
  }

  const clock = normalized.match(/(?:ساعت\s*)?(\d{1,2})(?:(?::|\s+و\s+)(\d{1,2}))?\s*(صبح|ظهر|بعدازظهر|عصر|شب)?/);
  if (clock && (/ساعت/.test(normalized.slice(Math.max(0, (clock.index ?? 0) - 6), (clock.index ?? 0) + clock[0].length)) || clock[3])) {
    let hour = Number(clock[1]);
    const minute = Number(clock[2] ?? 0);
    const period = clock[3];
    if (["ظهر", "بعدازظهر", "عصر", "شب"].includes(period ?? "") && hour < 12) hour += 12;
    if (period === "صبح" && hour === 12) hour = 0;
    if (hour <= 23 && minute <= 59) {
      date.setHours(hour, minute, 0, 0);
      hasDate = true;
    } else note = "ساعت نوشته‌شده معتبر نیست؛ زمان را دستی بررسی کن.";
  } else if (hasDate) {
    const defaultHour = /امشب|شب/.test(normalized) ? 21 : /عصر|بعدازظهر/.test(normalized) ? 18 : /ظهر/.test(normalized) ? 12 : 9;
    date.setHours(defaultHour, 0, 0, 0);
    note = "زمان دقیق در متن نبود؛ ساعت پیشنهادی را بررسی کن.";
  }

  if (/هر\s*روز/.test(normalized) && /\d+\s+و\s+\d+/.test(normalized)) {
    note = "متن ممکن است چند ساعت مصرف دارو داشته باشد؛ برای ثبت دارو از فرم داروها یا ایجنت استفاده کن.";
  }

  return {
    content: input.trim(),
    due: hasDate ? toLocalInput(date) : "",
    recurrence: /هر\s*روز|روزانه/.test(normalized) ? "daily" : /هر\s*هفته|هفتگی/.test(normalized) ? "weekly" : /هر\s*ماه|ماهانه/.test(normalized) ? "monthly" : "",
    priority: /فوری|اضطراری/.test(normalized) ? 3 : /مهم/.test(normalized) ? 2 : 1,
    note,
  };
}

