import Link from "next/link";
import { BellIcon, ChatIcon, LogoMark, MailIcon, PillIcon } from "@/components/Icons";

const FEATURES = [
  { Icon: PillIcon, title: "یادآور دارو", text: "اعلان سر ساعت با دکمه‌ی «خوردم»، هشدار تموم شدن دارو و آمار مصرف." },
  { Icon: MailIcon, title: "ایمیل هوشمند", text: "خلاصه، دسته‌بندی فوری/مهم و استخراج کارها از ایمیل‌ها." },
  { Icon: BellIcon, title: "یادآوری و کارها", text: "به زبان خودت بگو؛ تاریخ، تکرار و اولویت رو خودش می‌فهمه." },
  { Icon: ChatIcon, title: "ایجنت گفتگو", text: "ازش بپرس امروز چی داری، یا بگو برنامه‌ی فردات رو بچینه." },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div className="gradient-accent pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl" />
      <LogoMark width={64} height={64} className="animate-rise relative" />
      <h1 className="animate-rise relative mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
        دستیار شخصی <span className="text-gradient">هوشمند</span> تو
      </h1>
      <p className="animate-rise relative mt-5 max-w-xl text-base leading-8 text-muted sm:text-lg">
        RCA Agent ایمیل‌هات رو می‌خونه، داروهات رو یادت میندازه، کارهات رو مرتب می‌کنه و هر صبح یه خلاصه‌ی
        کوتاه از روزت بهت می‌ده.
      </p>
      <Link href="/login/" className="btn btn-primary animate-rise relative mt-8 px-8 py-3 text-base">
        شروع کن
      </Link>
      <div className="relative mt-16 grid w-full max-w-4xl gap-3 text-right sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ Icon, title, text }) => (
          <div key={title} className="card animate-rise p-5">
            <span className="mb-3 grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon />
            </span>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
