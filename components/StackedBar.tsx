"use client";

import Link from "next/link";
import { useState } from "react";
import { compactMoney, money } from "@/lib/format";

export type Segment = { label: string; color: string; value: number };

/**
 * One column of a stacked bar chart, a link to its own page. Hover (or touch) it to read the amounts: its total and
 * what each part came to, with the part under the pointer in bold.
 */
export default function StackedBar({ label, href, segments, total, max, avg, on, currency }: {
  label: string; href: string; segments: Segment[]; total: number; max: number; avg: number | null; on: boolean; currency: string;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; seg: string | null } | null>(null);
  const parts = segments.filter((s) => s.value > 0);
  const move = (e: React.PointerEvent<HTMLElement>, seg: string | null) => {
    const box = e.currentTarget.closest("a")!.getBoundingClientRect();
    setTip({ x: box.left + box.width / 2, y: box.top, seg });
  };

  return (
    <li className="min-w-9 flex-1">
      <Link href={href} aria-current={on ? "page" : undefined}
        aria-label={`${label}: ${money(total, currency)}${parts.length > 1 ? `. ${parts.map((s) => `${s.label} ${money(s.value, currency)}`).join(", ")}` : ""}`}
        onPointerEnter={(e) => move(e, null)} onPointerMove={(e) => move(e, tip?.seg ?? null)} onPointerLeave={() => setTip(null)}
        className={`group flex flex-col items-center gap-1 rounded-lg px-0.5 pt-1 ${on ? "bg-surface-2" : "hover:bg-surface-2"}`}>
        <span className={`num text-[10px] ${on ? "font-bold text-ink" : "text-ink-3"}`}>{total > 0 ? compactMoney(total, currency) : "–"}</span>
        <span className="relative flex h-40 w-full max-w-12 flex-col-reverse">
          {parts.map((s, k) => (
            <span key={s.label} style={{ height: `${(s.value / max) * 100}%`, background: s.color }}
              onPointerEnter={(e) => move(e, s.label)}
              className={`block w-full shrink-0 ${k === 0 ? "rounded-b-md" : ""} ${on ? "" : "opacity-40 group-hover:opacity-70"}`} />
          ))}
          {avg !== null && <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: `${avg * 100}%` }} />}
        </span>
        <span className={`whitespace-nowrap pb-1 text-[11px] ${on ? "font-bold text-ink" : "text-ink-3"}`}>{label}</span>
      </Link>
      {tip && (
        <span role="tooltip" style={{ left: tip.x, top: tip.y - 6 }}
          className="num pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full space-y-0.5 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-surface shadow-lg">
          <span className="block font-bold">{label} · {money(total, currency)}</span>
          {parts.length === 0 && <span className="block opacity-80">nothing recorded</span>}
          {parts.slice().reverse().map((s) => (
            <span key={s.label} className={`flex items-center justify-between gap-4 ${tip.seg === s.label ? "font-bold" : "opacity-80"}`}>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <span>{money(s.value, currency)}</span>
            </span>
          ))}
        </span>
      )}
    </li>
  );
}
