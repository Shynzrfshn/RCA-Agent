import Link from "next/link";
import { ArrowIcon, BellIcon, ChatIcon, LogoMark, MailIcon, PillIcon } from "@/components/Icons";

const FEATURES = [
  { Icon: BellIcon, title: "برنامه و یادآوری", text: "کارها، زمان‌ها و اولویت‌ها را در یک فضای روشن ببین." },
  { Icon: PillIcon, title: "پیگیری دارو", text: "دوزهای امروز و روند مصرف را با جزئیات ثبت کن." },
  { Icon: MailIcon, title: "ایمیل‌های مهم", text: "از میان پیام‌ها، موارد نیازمند توجه را جدا کن." },
  { Icon: ChatIcon, title: "ایجنت شخصی", text: "دربارهٔ روزت بپرس و کارها را به زبان طبیعی پیش ببر." },
];

export default function Home() {
  return (
    <main className="landing min-h-screen px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-border pb-5">
          <div className="flex items-center gap-3"><LogoMark width={38} height={38} /><span className="text-lg font-bold tracking-tight">RCA<span className="font-normal">/Agent</span></span></div>
          <Link href="/login/" className="btn btn-ghost">ورود به فضای شخصی <ArrowIcon width={16} height={16} /></Link>
        </header>
        <div className="grid min-h-[33rem] items-center gap-12 py-14 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 border-b border-accent pb-2 text-xs font-bold tracking-[.14em] text-accent">فضای شخصی برای روزهای پیچیده</div>
            <h1 className="max-w-3xl text-5xl font-bold leading-[1.35] tracking-tight sm:text-7xl">وضوح بیشتر<br /><span className="text-accent">در هر روز.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-9 text-muted sm:text-lg">کارها، داروها، ایمیل‌های مهم و گفتگو با ایجنت در یک فضای آرام و منظم. تصمیم با توست؛ RCA اطلاعات را کنار هم می‌گذارد.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/login/" className="btn btn-primary px-7">شروع کار <ArrowIcon width={18} height={18} /></Link><span className="text-xs text-muted">بدون پرداخت برای قابلیت‌های پایه</span></div>
          </div>
          <div className="hero-preview card relative overflow-hidden p-5 sm:p-7" aria-label="پیش‌نمایش فضای کاری">
            <div className="mb-8 flex items-center justify-between border-b border-border pb-5"><span className="text-xs font-bold tracking-widest text-muted" dir="ltr">YOUR DAY / RCA</span><span className="rounded-full bg-success-soft px-3 py-1 text-xs text-success">آماده برای امروز</span></div>
            <div className="mb-6 text-2xl font-bold">یک نگاه، همهٔ اولویت‌ها</div>
            <div className="space-y-3">
              {[{ n: "01", title: "کارهای امروز", detail: "قدم بعدی روشن است", Icon: BellIcon }, { n: "02", title: "دوزهای دارو", detail: "زمان‌بندی و سابقهٔ مصرف", Icon: PillIcon }, { n: "03", title: "ایمیل‌های نیازمند توجه", detail: "خلاصه و اقدام پیشنهادی", Icon: MailIcon }].map(({ n, title, detail, Icon }) => <div key={n} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"><span className="text-xs tabular-nums text-accent" dir="ltr">{n}</span><span className="grid size-10 place-items-center rounded-md bg-accent-soft text-accent"><Icon width={19} height={19} /></span><div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs text-muted">{detail}</div></div></div>)}
            </div>
            <div className="mt-8 border-t border-border pt-5 text-xs leading-6 text-muted">یک ابزار شخصی با کنترل روشن روی داده‌ها و سرویس‌های هوش مصنوعی.</div>
          </div>
        </div>
        <section className="grid gap-3 border-t border-border py-8 sm:grid-cols-2 lg:grid-cols-4" aria-label="قابلیت‌ها">
          {FEATURES.map(({ Icon, title, text }, i) => <div key={title} className="p-4"><div className="mb-5 flex items-center justify-between"><Icon width={23} height={23} className="text-accent" /><span className="text-xs text-muted" dir="ltr">0{i + 1}</span></div><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-7 text-muted">{text}</p></div>)}
        </section>
      </div>
    </main>
  );
}
