"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A small ⓘ that opens an explanation in place, for the "how is this worked out" text a page doesn't need to show.
 * Made of inline elements only, so it can sit inside a heading or a line of text. Closes on a tap outside or Escape.
 */
export default function Info({ label = "How this is worked out", children, className = "" }: { label?: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-block align-middle ${className}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-label={label} title={label} aria-expanded={open} aria-controls={id}
        className={`grid size-5 place-items-center rounded-full border border-current text-[11px] font-bold leading-none ${open ? "opacity-100" : "opacity-60 hover:opacity-100"}`}>
        i
      </button>
      {open && (
        <span id={id} role="note"
          className="absolute left-1/2 top-full z-30 mt-2 block w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink-2 shadow-xl">
          {children}
        </span>
      )}
    </span>
  );
}
