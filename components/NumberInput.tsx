"use client";

import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { flushSync } from "react-dom";

/** Groups the whole part in thousands as you type: "1234567.5" becomes "1,234,567.5". Keeps a trailing "." and the decimals as typed. */
export function group(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = (dot < 0 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (dot < 0) return grouped;
  return `${grouped || "0"}.${cleaned.slice(dot + 1).replace(/\./g, "")}`;
}

/**
 * Works out a sum typed in a field: + − × ÷ and brackets ("15000*6", "1,200 x 12", "(500+250)*4"). Commas are
 * ignored; x and × multiply, ÷ divides. A leading "=" (as in a spreadsheet) is allowed. Null when it isn't a whole,
 * valid sum. No eval: a small parser.
 */
export function calc(text: string): number | null {
  const t = text.trim().replace(/^=/, "").replace(/,/g, "").replace(/[x×X]/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/\s+/g, "");
  let i = 0;
  const sum = (): number => {
    let v = product();
    while (t[i] === "+" || t[i] === "-") { const op = t[i++]; const r = product(); v = op === "+" ? v + r : v - r; }
    return v;
  };
  const product = (): number => {
    let v = factor();
    while (t[i] === "*" || t[i] === "/") { const op = t[i++]; const r = factor(); v = op === "*" ? v * r : v / r; }
    return v;
  };
  const factor = (): number => {
    if (t[i] === "-") { i++; return -factor(); }
    if (t[i] === "+") { i++; return factor(); }
    if (t[i] === "(") { i++; const v = sum(); if (t[i++] !== ")") return NaN; return v; }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(t.slice(i));
    if (!m) return NaN;
    i += m[0].length;
    return Number(m[0]);
  };
  if (!t) return null;
  const v = sum();
  return i === t.length && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

/** How long typing pauses before a sum is worked out. */
const CALC_AFTER_MS = 800;

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  /** Pass `value` and `onValueChange` to control it. Both are plain numbers as text, without commas. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (raw: string) => void;
  /** Lets a sum be typed without "=" ("15000*6"): it is worked out once typing pauses, or on leaving the field or Enter. */
  math?: boolean;
};

/**
 * A text field for amounts that shows thousands separators while you type. What is submitted keeps the
 * commas (the server ignores them); `onValueChange` receives the number without them. Starting with "=" types a
 * sum ("=1000*6") that is worked out on leaving the field or Enter, like a spreadsheet. With `math`, a sum can also be
 * typed without the "=" and is worked out once typing pauses.
 */
export default function NumberInput({ value, defaultValue = "", onValueChange, math = false, onBlur, onKeyDown, ...rest }: Props) {
  const [inner, setInner] = useState(defaultValue);
  // A sum being typed, shown as typed until it is worked out.
  const [sum, setSum] = useState<string | null>(null);
  // A sum that didn't work out when left: marked until it is changed.
  const [bad, setBad] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const controlled = value !== undefined;
  const shown = sum ?? group(controlled ? value : inner);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** Puts the result of the sum in the field; a sum that doesn't work out stays as typed. */
  const work = (text: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const v = calc(text);
    if (v === null) { setBad(true); return; }
    const raw = String(v);
    setSum(null);
    if (!controlled) setInner(raw);
    onValueChange?.(raw);
  };

  // A form reset (after a successful save) puts back the starting value.
  useEffect(() => {
    const form = ref.current?.form;
    const onReset = () => { setInner(defaultValue); setSum(null); setBad(false); };
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
      aria-invalid={bad || undefined}
      title={bad ? "This sum doesn't work out" : rest.title}
      // flushSync so a parent's onBlur already sees the result in the field.
      onBlur={(e) => { if (sum !== null) flushSync(() => work(sum)); onBlur?.(e); }}
      onKeyDown={(e) => {
        // Enter submits the form: work the sum out first, so the number is what gets sent.
        if (e.key === "Enter" && sum !== null) flushSync(() => work(sum));
        onKeyDown?.(e);
      }}
      onChange={(e) => {
        const el = e.target;
        setBad(false);
        // A leading "=" starts a sum: keep it as typed and work it out on leaving the field or Enter.
        if (/^\s*=/.test(el.value)) {
          if (timer.current) { clearTimeout(timer.current); timer.current = null; }
          setSum(`=${el.value.replace(/^\s*=/, "").replace(/[^0-9.,+\-*/xX×÷()\s−–]/g, "")}`);
          return;
        }
        // With `math`, anything besides digits, commas and a dot is a sum: keep it as typed and work it out after a pause.
        if (math && /[^0-9.,\s]/.test(el.value)) {
          const text = el.value.replace(/[^0-9.,+\-*/xX×÷()\s−–]/g, "");
          setSum(text);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => work(text), CALC_AFTER_MS);
          return;
        }
        if (sum !== null) { setSum(null); if (timer.current) { clearTimeout(timer.current); timer.current = null; } }
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
