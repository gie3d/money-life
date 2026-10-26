"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) - 1, d: +s.slice(8, 10) });
/** Adds days in UTC so a daylight-saving jump can never skip or repeat a day. */
const addDays = (s: string, n: number) => {
  const { y, m, d } = parse(s);
  const t = new Date(Date.UTC(y, m, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};
const addMonths = (s: string, n: number) => {
  const { y, m, d } = parse(s);
  const last = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m + n, Math.min(d, last)));
  return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};
const localToday = () => {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth(), n.getDate());
};
const pretty = (s: string) => `${parse(s).d} ${MONTHS[parse(s).m].slice(0, 3)} ${parse(s).y}`;

const noSubscribe = () => () => {};

/**
 * A calendar popover that submits an ISO date under `name`. It starts on today in the
 * visitor's own time zone, which the server can't know, so the first render is empty.
 */
export default function DatePicker({ name, label }: { name: string; label: string }) {
  const today = useSyncExternalStore(noSubscribe, localToday, () => "");
  const [picked, setPicked] = useState<string | null>(null);
  const value = picked ?? today;

  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(""); // the day the keyboard is on
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  // A form reset (after a successful save) goes back to today.
  useEffect(() => {
    const form = input.current?.form;
    const onReset = () => setPicked(null);
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Keep keyboard focus on the day the cursor is on.
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLButtonElement>('[data-day][tabindex="0"]')?.focus();
  }, [open, cursor]);

  const show = (s: string) => { setCursor(s); setOpen(true); };
  const choose = (s: string) => { setPicked(s); setOpen(false); trigger.current?.focus(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); trigger.current?.focus(); return; }
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -((new Date(`${cursor}T00:00:00Z`).getUTCDay() + 6) % 7)),
      End: () => addDays(cursor, 6 - ((new Date(`${cursor}T00:00:00Z`).getUTCDay() + 6) % 7)),
    };
    if (step[e.key]) { e.preventDefault(); setCursor(step[e.key]()); }
  };

  const view = cursor || value || today;
  const { y, m } = view ? parse(view) : { y: 0, m: 0 };
  const lead = view ? (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7 : 0; // Monday first
  const days = view ? new Date(Date.UTC(y, m + 1, 0)).getUTCDate() : 0;

  return (
    <div ref={root} className="relative">
      <input ref={input} type="hidden" name={name} value={value} />
      <button
        ref={trigger}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value ? pretty(value) : "loading"}. Change date`}
        onClick={() => (open ? setOpen(false) : show(value || today))}
        className="field flex items-center justify-between gap-2 text-left"
      >
        <span className="num whitespace-nowrap">{value ? pretty(value) : " "}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-3">
          <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>

      {open && view && (
        <div role="dialog" aria-label={`Choose ${label.toLowerCase()}`} onKeyDown={onKey} className="absolute left-0 z-30 mt-2 w-72 rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setCursor(addMonths(view, -1))} className="grid size-8 place-items-center rounded-full hover:bg-surface-2">‹</button>
            <p className="text-sm font-bold" aria-live="polite">{MONTHS[m]} {y}</p>
            <button type="button" aria-label="Next month" onClick={() => setCursor(addMonths(view, 1))} className="grid size-8 place-items-center rounded-full hover:bg-surface-2">›</button>
          </div>
          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((w) => <span key={w} className="eyebrow py-1">{w}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const s = iso(y, m, i + 1);
              const selected = s === value;
              return (
                <button
                  key={s}
                  type="button"
                  data-day
                  tabIndex={s === view ? 0 : -1}
                  aria-label={pretty(s)}
                  aria-pressed={selected}
                  onClick={() => choose(s)}
                  className={`num mx-auto grid size-9 place-items-center rounded-full text-sm ${
                    selected ? "bg-brand font-bold text-white" : s === today ? "font-bold text-brand hover:bg-surface-2" : "hover:bg-surface-2"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <button type="button" onClick={() => choose(today)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand hover:bg-surface-2">Today</button>
            <button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-3 hover:bg-surface-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
