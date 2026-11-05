# RCA Agent

دستیار شخصی هوشمند: ثبت کار و یادآوری با زبان طبیعی فارسی، یادآور دارو با اعلان، خلاصه و دسته‌بندی ایمیل،
گفتگو با ایجنت (LLM از طریق OpenRouter) و خلاصه‌ی صبحگاهی.

## معماری

```
GitHub Pages (Next.js static)  ──►  Supabase
  داشبورد، کارها، داروها،            ├─ Postgres + RLS (supabase/migrations)
  ایمیل، چت، تنظیمات، PWA            ├─ Edge Functions (supabase/functions)
  Service Worker (public/sw.js)      │    agent        چت با ایجنت + خلاصه‌ی روز (LLM با tool calling)
                                     │    tick         هر دقیقه: اعلان دارو/یادآوری، هشدار موجودی، خلاصه‌ی صبح
                                     │    gmail-auth   اتصال OAuth جیمیل (فقط خواندنی)
                                     │    gmail-sync   هر ۱۰ دقیقه: دریافت و دسته‌بندی ایمیل‌ها با LLM
                                     │    push-action  دکمه‌های «خوردم / بعداً» روی اعلان
                                     └─ pg_cron + pg_net (supabase/cron.sql)
```

## راه‌اندازی

### ۱. دیتابیس
در Supabase › SQL Editor به ترتیب اجرا کن:
1. `supabase/schema.sql` (اگه قبلاً اجرا نشده)
2. `supabase/migrations/20261104000000_agent_v2.sql`

### ۲. کلیدها و Secretها
فایل `supabase/functions/.env` (در git نیست) از قبل با کلیدهای VAPID، `ENCRYPTION_KEY`، `SIGNING_SECRET` و
`CRON_SECRET` ساخته شده. این‌ها رو خودت پر کن:

| متغیر | از کجا |
|---|---|
| `LLM_API_KEY` | openrouter.ai/keys (مدل پیش‌فرض رایگان: `nvidia/nemotron-3.5-super-vl:free`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console (پایین‌تر) |
| `VAPID_SUBJECT` | `mailto:` ایمیل خودت |
| `APP_URL` / `APP_ORIGIN` | آدرس سایت (پیش‌فرض: GitHub Pages همین ریپو) |

### ۳. Deploy توابع
```bash
npm i -g supabase
```
```bash
supabase login
```
```bash
supabase link --project-ref <project-ref>
```
```bash
supabase secrets set --env-file supabase/functions/.env
```
```bash
supabase functions deploy
```

### ۴. زمان‌بندی (cron)
در SQL Editor:
```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET از فایل .env>', 'cron_secret');
```
بعد محتوای `supabase/cron.sql` رو اجرا کن.

### ۵. اتصال جیمیل (Google Cloud)
1. یه پروژه بساز و **Gmail API** رو فعال کن.
2. OAuth consent screen: نوع External، ایمیل خودت رو در Test users اضافه کن، scope `gmail.readonly`.
3. Credentials › OAuth client ID › Web application، Redirect URI:
   `https://<project-ref>.supabase.co/functions/v1/gmail-auth`
4. Client ID/Secret رو در `.env` بذار و دوباره `supabase secrets set` بزن.

> در حالت Testing گوگل، refresh token ممکنه بعد از ۷ روز منقضی بشه؛ در این صورت از تنظیمات دوباره وصل شو
> (یا اپ رو Publish کن).

### ۶. فرانت‌اند
GitHub › Settings › Secrets and variables › Actions › **Variables**:
`NEXT_PUBLIC_SUPABASE_URL`، `NEXT_PUBLIC_SUPABASE_ANON_KEY`، `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
(مقدار آخری = `VAPID_PUBLIC_KEY` از `.env`).

برای اجرای محلی `.env.example` رو به `.env.local` کپی کن و:
```bash
npm install
```
```bash
npm run dev
```

در Supabase › Authentication › URL Configuration آدرس سایت و `http://localhost:3000` رو به Redirect URLs اضافه کن.

## امنیت
- همه‌ی جدول‌ها RLS دارن؛ توکن جیمیل با AES-GCM رمز شده و فقط سرویس به جدول `email_credentials` دسترسی داره.
- ایجنت ایمیل نمی‌فرسته و محتوای ایمیل رو «داده‌ی نامطمئن» حساب می‌کنه (در برابر prompt injection).
- دکمه‌های اعلان و state اتصال OAuth با HMAC امضا و منقضی می‌شن.
- هر کاری ایجنت انجام بده در جدول `agent_actions` ثبت می‌شه.
- مدل با `LLM_MODEL` و `LLM_BASE_URL` قابل تغییره؛ هر API سازگار با OpenAI کار می‌کنه (OpenRouter، API رسمی DeepSeek با `https://api.deepseek.com` و `deepseek-v4-flash`، و غیره).

## مدل (OpenRouter)
- پیش‌فرض: `nvidia/nemotron-3.5-super-vl:free` (رایگان، tool calling و فارسی خوب؛ تست شده در ۱۴ آبان ۱۴۰۵).
- DeepSeek V4 دیگه نسخه‌ی رایگان نداره. با شارژ حساب OpenRouter (حتی ۵ دلار برای ماه‌ها کافیه) بذار:
  `LLM_MODEL=deepseek/deepseek-v4.1-flash`
- مدل‌های رایگان سقف روزانه دارن و گاهی شلوغ می‌شن؛ ایجنت در خطای 429 خودش دوباره تلاش می‌کنه.
- بعد از هر تغییر: `npx supabase secrets set --env-file supabase/functions/.env`
