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
    <div className="app-frame min-h-screen md:grid md:grid-cols-[16.5rem_1fr]">
      {/* Desktop sidebar (on the right, since the page is RTL) */}
      <aside className="app-sidebar sticky top-0 hidden h-screen flex-col gap-1 border-l border-border p-5 md:flex">
        <Link href="/dashboard/" className="mb-11 flex items-center gap-3 px-2 pt-2">
          <LogoMark width={36} height={36} />
          <span className="flex flex-col leading-tight"><strong className="text-base tracking-tight">RCA<span className="font-normal">/Agent</span></strong><small className="mt-1 text-[10px] tracking-[.2em] text-muted" dir="ltr">PERSONAL SYSTEM</small></span>
        </Link>
        <span className="mb-3 px-3 text-[10px] font-bold tracking-[.16em] text-muted">فضای کاری</span>
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`nav-link flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive(href)
                ? "is-active bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon />
            {label}
          </Link>
        ))}
        <div className="mt-auto border-t border-border px-3 pt-5">
          <span className="mb-1 block text-[10px] text-muted">حساب متصل</span>
          <span className="block truncate text-xs" dir="ltr">{user.email}</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-24 md:pb-10">
        <header className="mx-auto flex w-full max-w-6xl items-end justify-between gap-4 px-4 pt-7 pb-7 sm:px-8 sm:pt-12">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[.12em] text-accent"><span className="size-1.5 rounded-full bg-accent" /> فضای شخصی / RCA</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="ناوبری اصلی"
        className="mobile-nav fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-border bg-surface/95 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] ${
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
