"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRequireUser } from "@/lib/useSession";
import {
  ChatIcon,
  HomeIcon,
  ListIcon,
  LogoMark,
  MailIcon,
  PillIcon,
  SettingsIcon,
} from "./Icons";

const NAV = [
  { href: "/dashboard/", label: "امروز", Icon: HomeIcon },
  { href: "/tasks/", label: "کارها", Icon: ListIcon },
  { href: "/meds/", label: "داروها", Icon: PillIcon },
  { href: "/inbox/", label: "ایمیل", Icon: MailIcon },
  { href: "/chat/", label: "ایجنت", Icon: ChatIcon },
  { href: "/settings/", label: "تنظیمات", Icon: SettingsIcon },
];

export default function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const user = useRequireUser();
  const pathname = usePathname();
  const isActive = (href: string) => pathname?.replace(/\/?$/, "/") === href;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <LogoMark className="animate-pulse" width={40} height={40} />
        <span className="sr-only">در حال بارگذاری</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar (on the right, since the page is RTL) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-l border-border bg-surface p-4 md:flex">
        <Link href="/dashboard/" className="mb-6 flex items-center gap-2 px-2 pt-1">
          <LogoMark />
          <span className="text-lg font-bold">RCA Agent</span>
        </Link>
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive(href)
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon />
            {label}
          </Link>
        ))}
        <div className="mt-auto truncate px-3 text-xs text-muted" dir="ltr">
          {user.email}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-24 md:pb-10">
        <header className="mx-auto flex w-full max-w-4xl items-end justify-between gap-4 px-4 pt-6 pb-4 sm:px-8 sm:pt-10">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="ناوبری اصلی"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-border bg-surface/90 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] ${
              isActive(href) ? "text-accent" : "text-muted"
            }`}
          >
            <Icon width={22} height={22} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
