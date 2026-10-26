"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_COLORS } from "@/lib/types";

/** A colour swatch that opens a popover of preset colours plus a custom one. Submits a hex value under `name`. */
export default function ColorPicker({
  name,
  defaultValue,
  label,
  autoSubmit = false,
}: {
  name: string;
  defaultValue: string;
  label: string;
  /** Submit the surrounding form as soon as a colour is chosen. */
  autoSubmit?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // A form reset (after adding a category) goes back to the suggested colour.
  useEffect(() => {
    const form = input.current?.form;
    const onReset = () => setValue(defaultValue);
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pick = (c: string) => {
    setValue(c);
    if (input.current) input.current.value = c; // set now, so the form submitted below already has it
    if (autoSubmit && c.toLowerCase() !== defaultValue.toLowerCase()) input.current?.form?.requestSubmit();
  };

  return (
    <div ref={root} className="relative" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <input ref={input} type="hidden" name={name} value={value} readOnly />
      <button
        type="button"
        aria-label={`${label}: ${value}. Change colour`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid size-9 shrink-0 place-items-center rounded-full border border-line"
      >
        <span className="size-5 rounded-full" style={{ background: value }} />
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute left-0 z-30 mt-2 w-52 rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <div className="grid grid-cols-5 gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={c === value.toLowerCase()}
                onClick={() => pick(c)}
                className={`size-8 rounded-full ${c === value.toLowerCase() ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm font-medium">
            Custom
            <input type="color" value={value} onChange={(e) => setValue(e.target.value)} onBlur={(e) => pick(e.target.value)} className="h-8 w-14 cursor-pointer rounded-lg border border-line bg-transparent" />
          </label>
        </div>
      )}
    </div>
  );
}
