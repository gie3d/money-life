"use client";

import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";

/** Groups the whole part in thousands as you type: "1234567.5" becomes "1,234,567.5". Keeps a trailing "." and the decimals as typed. */
export function group(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = (dot < 0 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (dot < 0) return grouped;
  return `${grouped || "0"}.${cleaned.slice(dot + 1).replace(/\./g, "")}`;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  /** Pass `value` and `onValueChange` to control it. Both are plain numbers as text, without commas. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (raw: string) => void;
};

/**
 * A text field for amounts that shows thousands separators while you type. What is submitted keeps the
 * commas (the server ignores them); `onValueChange` receives the number without them.
 */
export default function NumberInput({ value, defaultValue = "", onValueChange, ...rest }: Props) {
  const [inner, setInner] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const controlled = value !== undefined;
  const shown = group(controlled ? value : inner);

  // A form reset (after a successful save) puts back the starting value.
  useEffect(() => {
    const form = ref.current?.form;
    const onReset = () => setInner(defaultValue);
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, [defaultValue]);

  // Reformatting moves the cursor to the end; put it back after the same digit it was after.
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onChange={(e) => {
        const el = e.target;
        const before = el.value.slice(0, el.selectionStart ?? el.value.length);
        const significant = before.replace(/[^0-9.]/g, "").length; // digits and the dot, not the commas
        const raw = group(el.value).replace(/,/g, "");
        const next = group(raw);
        let pos = 0;
        for (let seen = 0; pos < next.length && seen < significant; pos++) if (next[pos] !== ",") seen++;
        caret.current = pos;
        if (!controlled) setInner(raw);
        onValueChange?.(raw);
      }}
    />
  );
}
