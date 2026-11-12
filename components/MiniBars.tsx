"use client";

import { useState } from "react";
import { money, monthLabel } from "@/lib/format";

/**
 * A tiny column chart of one row's months, for the trend at a glance. Scaled to the row's own peak, so a small
 * category shows its shape as clearly as a big one. A month with nothing recorded is a faint tick; `selected` is
 * full colour, the others a little faded. Hover (or touch) a column to read its month and amount.
 */
export default function MiniBars({ values, selected, color, label, currency, width = 96, height = 28 }: {
  values: { key: string; value: number | null }[]; selected: string; color: string; label: string; currency: string; width?: number; height?: number;
}) {
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const max = Math.max(...values.map((v) => v.value ?? 0), 0);
  const slot = width / Math.max(values.length, 1);
  const bar = Math.max(slot - 2, 1);

  const point = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.min(Math.max(Math.floor(((e.clientX - box.left) / box.width) * values.length), 0), values.length - 1);
    setTip({ i, x: box.left + ((i + 0.5) / values.length) * box.width, y: box.top });
  };
  const hit = tip ? values[tip.i] : null;

  return (
    <>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block"
        onPointerMove={point} onPointerDown={point} onPointerLeave={() => setTip(null)}>
        {values.map((v, i) => {
          const x = i * slot + (slot - bar) / 2;
          const on = tip?.i === i;
          if (v.value === null || v.value <= 0 || max <= 0) return <rect key={v.key} x={x} y={height - (on ? 3 : 1.5)} width={bar} height={on ? 3 : 1.5} rx={0.75} fill={on ? color : "var(--line)"} />;
          const h = Math.max((v.value / max) * height, 2);
          return <rect key={v.key} x={x} y={height - h} width={bar} height={h} rx={1} fill={color} opacity={on || v.key === selected ? 1 : 0.45} />;
        })}
      </svg>
      {tip && hit && (
        <span role="tooltip" style={{ left: tip.x, top: tip.y - 6 }}
          className="num pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-surface shadow-lg">
          {monthLabel(hit.key)} · {hit.value === null ? "nothing recorded" : money(hit.value, currency)}
        </span>
      )}
    </>
  );
}
