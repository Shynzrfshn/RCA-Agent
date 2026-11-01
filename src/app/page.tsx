import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
        دستیار شخصی روزانه
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        RCA Agent
      </h1>
      <p className="max-w-md text-base leading-7 text-muted">
        هر چی به ذهنت می‌رسه رو ثبت کن، صبح یه خلاصه‌ی مرتب از روزت بگیر و
        دیگه چیزی یادت نره.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-accent px-6 py-3 font-medium text-accent-foreground transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        شروع کن
      </Link>
    </main>
  );
}
