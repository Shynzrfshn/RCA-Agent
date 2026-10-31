import Link from "next/link";

export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center"
      dir="rtl"
    >
      <h1 className="text-3xl font-bold">RCA Agent</h1>
      <p className="max-w-md text-neutral-600">
        دستیار شخصی روزانه‌ت: هر چی به ذهنت رسید رو ثبت کن، صبح خلاصه‌ی روزت
        رو بگیر.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-black px-6 py-3 text-white"
      >
        شروع کن
      </Link>
    </main>
  );
}
