"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { isRecordPath, SECTIONS, sectionOf, type SectionId } from "@/lib/sections";

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

const GEAR = "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z";

/** The icon of each section in the bottom bar. */
function SectionIcon({ id }: { id: SectionId | "settings" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {id === "home" && <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></>}
      {id === "assets" && <><path d="M3 20h18" /><path d="M6 16V10" /><path d="M11 16V6" /><path d="M16 16v-4" /><path d="M20 16V8" /></>}
      {id === "future" && <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>}
      {id === "settings" && <><circle cx="12" cy="12" r="3" /><path d={GEAR} /></>}
    </svg>
  );
}

const PLUS = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);

export default function Nav({ userName }: { userName: string | null }) {
  const pathname = usePathname();
  const section = sectionOf(pathname);
  const onSettings = pathname.startsWith("/settings");
  const recording = isRecordPath(pathname);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-[1.05rem] font-extrabold tracking-tight">
            {/* The mark: a sprout, money that grows over a life. */}
            <span className="grid size-8 place-items-center rounded-xl bg-brand-soft text-[1.15rem] leading-none" aria-hidden>🌱</span>
            <span>Money<span className="text-brand">Life</span></span>
          </Link>
          {userName && (
            <nav aria-label="Sections" className="ml-2 hidden gap-1 lg:flex">
              {SECTIONS.map((s) => (
                <Link
                  key={s.id}
                  href={s.href}
                  aria-current={section === s.id ? "page" : undefined}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${section === s.id ? "bg-brand-soft text-brand" : "text-ink-3 hover:text-ink"}`}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {userName && (
              <Link href="/record" aria-current={recording ? "page" : undefined}
                className="hidden items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white hover:brightness-105 lg:inline-flex">
                {PLUS} Record
              </Link>
            )}
            <RefreshButton />
            <ThemeToggle />
            {userName && (
              <Link href="/settings" aria-label="Settings" aria-current={onSettings ? "page" : undefined} title={`Settings · signed in as ${userName}`}
                className={`hidden size-9 place-items-center lg:grid rounded-full ${onSettings ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-2"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" /><path d={GEAR} />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* On a phone the sections sit in a bar at the bottom, in reach of a thumb, with Record in the middle. */}
      {userName && (
        <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden [padding-bottom:env(safe-area-inset-bottom)]">
          <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
            {SECTIONS.slice(0, 2).map((s) => <BarLink key={s.id} href={s.href} label={s.label} active={section === s.id} icon={<SectionIcon id={s.id} />} />)}
            <div className="grid place-items-center">
              <Link href="/record" aria-label="Record" aria-current={recording ? "page" : undefined}
                className="grid size-13 -translate-y-3 place-items-center rounded-full bg-brand text-white shadow-lg ring-4 ring-ground active:scale-95">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </Link>
            </div>
            <BarLink href={SECTIONS[2].href} label={SECTIONS[2].label} active={section === "future"} icon={<SectionIcon id="future" />} />
            <BarLink href="/settings" label="Settings" active={onSettings} icon={<SectionIcon id="settings" />} />
          </div>
        </nav>
      )}
    </>
  );
}

function BarLink({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${active ? "text-brand" : "text-ink-3"}`}>
      {icon}
      {label}
    </Link>
  );
}
