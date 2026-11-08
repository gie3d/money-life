"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { logout } from "@/app/actions/auth";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/performance", label: "Performance" },
  { href: "/accounts", label: "Assets" },
  { href: "/goals", label: "Goals" },
  { href: "/plans", label: "Plans" },
  { href: "/bills", label: "Bills" },
] as const;

const THEME_EVENT = "ml-theme-change";

const subscribeTheme = (onChange: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
};

const readTheme = (): "light" | "dark" => {
  const stamped = document.documentElement.getAttribute("data-theme");
  if (stamped === "dark" || stamped === "light") return stamped;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ml-theme", next); } catch {}
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  return (
    <button onClick={flip} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "dark" ? <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
      </svg>
    </button>
  );
}

function RefreshButton() {
  const [spin, setSpin] = useState(false);
  return (
    <button
      onClick={() => { setSpin(true); window.location.reload(); }}
      aria-label="Reload the app" title="Reload"
      className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={spin ? "animate-spin" : ""}>
        <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}

export default function Nav({ userName }: { userName: string | null }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  // The menu on a narrow screen is open for the page it was opened on, so going anywhere closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[1.05rem] font-extrabold tracking-tight">
          {/* The mark: a sprout, money that grows over a life. */}
          <span className="grid size-8 place-items-center rounded-xl bg-brand-soft text-[1.15rem] leading-none" aria-hidden>🌱</span>
          <span>Money<span className="text-brand">Life</span></span>
        </Link>
        {userName && (
          <nav className="ml-2 hidden min-w-0 gap-1 overflow-x-auto lg:flex">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active(t.href) ? "page" : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${active(t.href) ? "bg-brand-soft text-brand" : "text-ink-3"}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <RefreshButton />
          <ThemeToggle />
          {userName && (
            <Link href="/settings" aria-label="Settings" aria-current={pathname.startsWith("/settings") ? "page" : undefined} title="Settings"
              className={`hidden size-9 place-items-center lg:grid rounded-full ${pathname.startsWith("/settings") ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-2"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </Link>
          )}
          {userName && (
            <form action={logout} className="hidden lg:block">
              <button className="rounded-full bg-surface-2 px-3.5 py-2 text-sm font-semibold text-ink-2" title={`Signed in as ${userName}`}>
                Sign out
              </button>
            </form>
          )}
          {userName && (
            <button onClick={() => setOpenOn(open ? null : pathname)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close the menu" : "Open the menu"}
              className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2 lg:hidden">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          )}
        </div>
      </div>
      {userName && open && (
        <nav id="mobile-menu" aria-label="Menu" className="absolute inset-x-0 top-full border-b border-line bg-surface px-4 pb-4 pt-2 shadow-lg lg:hidden">
          {[...TABS, { href: "/settings", label: "Settings" }].map((t) => (
            <Link key={t.href} href={t.href} onClick={close} aria-current={active(t.href) ? "page" : undefined}
              className={`block rounded-xl px-3 py-3 text-base font-semibold ${active(t.href) ? "bg-brand-soft text-brand" : "text-ink-2"}`}>
              {t.label}
            </Link>
          ))}
          <form action={logout} className="mt-2 border-t border-line pt-3">
            <button className="w-full rounded-xl bg-surface-2 px-3 py-3 text-left text-base font-semibold text-ink-2">Sign out <span className="font-normal text-ink-3">· {userName}</span></button>
          </form>
        </nav>
      )}
    </header>
  );
}
