"use client";

import { useEffect, useState } from "react";

const EVERY = 60_000;

/**
 * Compares the version this page was loaded with to what the server runs now (every minute, and when the app comes
 * back to the foreground), and offers a reload when they differ. For an installed web app that stays open for days.
 */
export default function UpdateBanner({ version }: { version: string }) {
  const [stale, setStale] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const now = (await res.json()) as { version?: string };
        if (live && now.version && now.version !== version) setStale(true);
      } catch {}
    };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    const timer = setInterval(check, EVERY);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    void check();
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, [version]);

  if (!stale || hidden) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-surface shadow-xl [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
      <p className="min-w-0 flex-1 font-semibold">A newer version is available. Reload to get it.</p>
      <button onClick={() => window.location.reload()} className="shrink-0 rounded-full bg-brand px-4 py-1.5 font-bold text-white">Reload</button>
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="shrink-0 px-1 text-lg leading-none opacity-70">×</button>
    </div>
  );
}
