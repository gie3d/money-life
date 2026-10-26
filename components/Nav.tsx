"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { logout } from "@/app/actions/auth";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/accounts", label: "Assets" },
  { href: "/categories", label: "Categories" },
  { href: "/plans", label: "Plans" },
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

export default function Nav({ userName }: { userName: string | null }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="text-[1.05rem] font-extrabold tracking-tight">
          Money<span className="text-brand">Life</span>
        </Link>
        {userName && (
          <nav className="ml-2 flex min-w-0 gap-1 overflow-x-auto">
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
          <ThemeToggle />
          {userName && (
            <Link href="/settings" aria-label="Settings" aria-current={pathname === "/settings" ? "page" : undefined} title="Settings"
              className={`grid size-9 place-items-center rounded-full ${pathname === "/settings" ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-2"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </Link>
          )}
          {userName && (
            <form action={logout}>
              <button className="rounded-full bg-surface-2 px-3.5 py-2 text-sm font-semibold text-ink-2" title={`Signed in as ${userName}`}>
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
