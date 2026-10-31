# RCA Agent

دستیار شخصی روزانه: ثبت سریع کارها/یادداشت‌ها/یادآوری‌ها و خلاصه‌ی روزانه.

## استک
- Next.js (App Router) + TypeScript + Tailwind
- Supabase (دیتابیس Postgres + Auth با لینک ورود ایمیلی)

## راه‌اندازی محلی
1. یک پروژه در [supabase.com](https://supabase.com) بساز.
2. محتوای `supabase/schema.sql` را در SQL Editor پروژه‌ات اجرا کن.
3. `.env.example` را کپی کن به `.env.local` و مقادیر Project URL و anon key را از
   Settings > API پر کن.
4. سرور را اجرا کن:

```bash
npm install
npm run dev
```

برنامه روی `http://localhost:3000` بالا می‌آید.
