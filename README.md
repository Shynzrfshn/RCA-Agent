# RCA Agent

دستیار شخصی هوشمند: ثبت کار و یادآوری با زبان طبیعی فارسی، یادآور دارو با اعلان، خلاصه و دسته‌بندی ایمیل،
گفتگو با ایجنت (مدل رایگان OpenRouter در حالت پیش‌فرض) و خلاصه‌ی صبحگاهی.

## سیاست هزینهٔ صفر

برنامه روی GitHub Pages و Supabase Free اجرا می‌شود و قابلیت‌های تازهٔ رابط کاربری هیچ وابستگی پولی ندارند. در حالت پیش‌فرض `LLM_FREE_ONLY=true` است: فقط endpoint رسمی OpenRouter و مدل‌های `:free` یا `openrouter/free` فراخوانی می‌شوند. اگر `LLM_MODEL` به مدل پولی تنظیم شده باشد، برنامه به مدل رایگان پیش‌فرض برمی‌گردد؛ مدل‌های جایگزین پولی نیز کنار گذاشته می‌شوند. سهمیهٔ رایگان ممکن است تمام شود و در این صورت درخواست AI خطا می‌دهد، نه اینکه خودکار به مدل پولی برود.

Gemini، Groq و Cloudflare ممکن است در **حساب رایگان** سهمیهٔ بدون هزینه داشته باشند، اما رفتار حساب ارتقایافته و قوانین قیمت‌گذاری‌شان مستقل از این برنامه است. بنابراین فعال‌سازی آن‌ها نیازمند تنظیم آگاهانهٔ `LLM_FREE_ONLY=false` و بررسی وضعیت صورتحساب همان حساب است. برای شرط سختِ هزینهٔ صفر، این مقدار را تغییر ندهید. ابزار ثبت و پیش‌نمایش محلی، کارها و داروها بدون درخواست AI کار می‌کنند.

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

### ایمیل صبحگاهی اختیاری
ارسال ایمیل صبحگاهی فقط برای کاربری انجام می‌شود که گزینهٔ مربوط را در تنظیمات روشن کرده باشد، رضایت AI فعال باشد و خلاصهٔ صبح همان روز آماده شده باشد. برای راه‌اندازی، `BREVO_API_KEY` و `MORNING_EMAIL_FROM` (فرستندهٔ تأییدشده در Brevo) را به Secretهای Edge Functions اضافه کنید و سپس تابع `tick` را deploy کنید. بدون این دو Secret هیچ ایمیلی ارسال نمی‌شود. سقف داخلی ۲۰۰ تلاش در روز و ۳ ارسال در هر اجرای زمان‌بند است؛ وضعیت هر روز در `morning_email_deliveries` ثبت می‌شود. شکست ارسال به‌صورت خودکار تکرار نمی‌شود تا ایمیل تکراری فرستاده نشود. هزینهٔ دامنهٔ فرستنده، اگر از قبل دامنه ندارید، ممکن است صفر نباشد.

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

### چند ارائه‌دهنده و انتقال خودکار

در Supabase Secrets کلیدهای هر سرویس را جدا ثبت کن. بدون کلید، آن سرویس از فهرست حذف می‌شود:

| سرویس | Secretهای لازم | مدل پیش‌فرض |
|---|---|---|
| OpenRouter | `LLM_API_KEY` | `LLM_MODEL=nvidia/nemotron-3.5-super-vl:free` |
| Google Gemini | `GEMINI_API_KEY` | `GEMINI_MODEL=gemini-2.5-flash-lite` |
| Groq | `GROQ_API_KEY` | `GROQ_MODEL=openai/gpt-oss-20b` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` | `CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct` |

`LLM_PROVIDER_ORDER=openrouter,gemini,groq,cloudflare` ترتیب را تعیین می‌کند، اما در حالت پیش‌فرض فقط OpenRouter با مدل رایگان استفاده می‌شود. برای عکس فقط سرویس‌های دارای vision، و برای tool calling فقط سرویس‌های سازگار انتخاب می‌شوند. هر درخواست ۲۲ ثانیه timeout دارد؛ خطای سهمیه، سرویس را موقتاً کنار می‌گذارد. محدودیت‌های رایگان و مدل‌ها تغییر می‌کنند؛ قبل از استقرار، دسترسی حساب و پشتیبانی از قابلیت‌ها را با درخواست آزمایشی بررسی کن. اطلاعات شخصی، ایمیل و دارو به سرویس‌های فعال فرستاده می‌شود؛ فقط ارائه‌دهندگانی را فعال کن که سیاست داده‌شان را پذیرفته‌ای.

مهاجرت‌ها را به‌ترتیب نام فایل‌های پوشهٔ `supabase/migrations` اجرا کن. نسخه‌های زمان‌دار `20261123162949_email_idempotency.sql`، `20261123162952_ai_consent.sql`، `20261123162957_agent_turns.sql` و `20261123163001_gmail_lease.sql` با تاریخچهٔ پروژهٔ فعلی Supabase هماهنگ هستند؛ مهاجرت‌های بعدی وضعیت چرخش ایجنت و دسترسی RPC را اصلاح می‌کنند. اگر پیش‌تر برای یک ایمیل task تکراری ساخته شده، داده‌های تکراری باید پیش از ایجاد index پاک‌سازی شوند. رضایت ارسال دادهٔ حساس به AI برای همه در ابتدا خاموش است؛ در تنظیمات برنامه می‌توان آن را فعال کرد. بدون این رضایت، چت، تحلیل ایمیل و خلاصه‌های AI غیرفعال می‌مانند، ولی یادآورها و ثبت دارو مستقل کار می‌کنند.

برای بررسی تغییرات پیش از deploy، `npm run lint`، `npm run test:llm` و `npx tsc --noEmit` را اجرا کن. تست LLM با پاسخ ساختگی، انتقال از OpenRouterِ محدودشده به Gemini را بررسی می‌کند؛ کلید واقعی و سهمیهٔ حساب را آزمایش نمی‌کند. همگام‌سازی Gmail در هر اجرا حداکثر ۱۰ ایمیل جدید را پردازش می‌کند تا زمان اجرای تابع کنترل شود.
- پیش‌فرض: `nvidia/nemotron-3.5-super-vl:free` (رایگان، tool calling و فارسی خوب؛ تست شده در ۱۴ آبان ۱۴۰۵).
- مدل‌های پولی در حالت پیش‌فرض کنار گذاشته می‌شوند. برای اجرای بدون هزینه، فقط از مدل‌های `:free` استفاده کن.
- مدل‌های رایگان سقف روزانه دارن و گاهی شلوغ می‌شن؛ ایجنت در خطای 429 خودش دوباره تلاش می‌کنه.
- بعد از هر تغییر: `npx supabase secrets set --env-file supabase/functions/.env`

