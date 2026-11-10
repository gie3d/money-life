"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "ml-stale-snooze";
const SNOOZE_DAYS = 7;

/**
 * A reminder on Home when some assets haven't been given a value for a while, since every forecast and goal is only
 * as fresh as they are. "Later" hides it on this device for a week.
 */
export default function StaleNotice({ count, days, names }: { count: number; days: number; names: string[] }) {
  // Shown only once the snooze has been checked, so a snoozed notice doesn't flash up.
  const [show, setShow] = useState(false);
  useEffect(() => {
    let until = 0;
    try { until = Number(localStorage.getItem(KEY)) || 0; } catch {}
    // Reading the browser's storage can only happen after mounting, so the state is set here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(Date.now() > until);
  }, []);
  if (!show || count === 0) return null;

  const later = () => {
    try { localStorage.setItem(KEY, String(Date.now() + SNOOZE_DAYS * 864e5)); } catch {}
    setShow(false);
  };
  const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ` and ${names.length - 3} more` : "");

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-sky-soft px-4 py-3 text-sm">
      <span aria-hidden className="text-lg">⏰</span>
      <p className="min-w-[12rem] flex-1">
        <span className="font-semibold">{count} {count === 1 ? "asset hasn't" : "assets haven't"} been updated in {days}+ days.</span>{" "}
        <span className="text-ink-3">{shown}</span>
      </p>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={later} className="rounded-full px-3 py-1.5 font-semibold text-ink-3 hover:text-ink">Later</button>
        <Link href="/update" className="btn py-1.5">Update now</Link>
      </div>
    </div>
  );
}
