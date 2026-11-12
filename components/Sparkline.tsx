"use client";

import { useState } from "react";
import { day, money, signedMoney } from "@/lib/format";
import type { Point } from "@/lib/performance";

/**
 * A tiny line of an asset's value over time, as a plain SVG (no script). Values hold until the next record,
 * so the line steps rather than slopes, like the full charts. `tone` colours it: gain, loss or flat.
 */
export default function Sparkline({ points, tone, label, startLabel, currency, balance = false, width = 96, height = 28 }: {
  points: Point[];
  tone: "up" | "down" | "flat";
  label: string;
  /** Written inside the chart at its left end, above the line, e.g. the start date and value. */
  startLabel?: string;
  /** For the hover: the currency, and whether the values are a real balance (shown as is) or growth (shown as a change). */
  currency?: string;
  balance?: boolean;
  width?: number;
  height?: number;
}) {
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const color = tone === "up" ? "var(--go)" : tone === "down" ? "var(--miss)" : "var(--ink-3)";
  if (points.length < 2) {
    return <svg width={width} height={height} role="img" aria-label={label}><line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 3" /></svg>;
  }
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const t0 = t(points[0].date);
  const span = t(points[points.length - 1].date) - t0 || 1;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = 2;
  const top = startLabel ? 12 : 0; // room for the label above the line
  const x = (d: string) => ((t(d) - t0) / span) * width;
  const y = (v: number) => (hi === lo ? top + (height - top) / 2 : top + pad + (1 - (v - lo) / (hi - lo)) * (height - top - pad * 2));

  // The point in force under the pointer: values hold until the next record.
  const hover = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const f = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
    const at = t0 + f * span;
    let i = 0;
    while (i + 1 < points.length && t(points[i + 1].date) <= at) i++;
    setTip({ i, x: e.clientX, y: box.top });
  };
  const hit = tip ? points[tip.i] : null;

  // Step after each point: across at the old value, then up or down to the new one.
  let d = `M0 ${y(points[0].value).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const px = x(points[i].date).toFixed(1);
    d += ` H${px} V${y(points[i].value).toFixed(1)}`;
  }
  const area = `${d} H${width} V${height} H0 Z`;
  const id = `spark-${label.replace(/[^a-z0-9]/gi, "").slice(0, 24)}-${Math.round(lo)}-${Math.round(hi)}`;

  return (
    <>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible" onPointerMove={currency ? hover : undefined} onPointerDown={currency ? hover : undefined} onPointerLeave={() => setTip(null)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {startLabel && <text x={0} y={8.5} fontSize={9} fill="var(--ink-3)" className="num">{startLabel}</text>}
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
      {hit && <circle cx={Math.min(x(hit.date), width)} cy={y(hit.value)} r={2.5} fill={color} stroke="var(--surface)" strokeWidth="1" />}
    </svg>
    {hit && tip && currency && (
      <span role="tooltip" style={{ left: tip.x, top: tip.y - 6 }}
        className="num pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-surface shadow-lg">
        {day(hit.date)} · {balance
          ? <>{money(hit.value, currency)} ({signedMoney(hit.value - points[0].value, currency)})</>
          : <>{signedMoney(hit.value - points[0].value, currency)} since {day(points[0].date, false)}</>}
      </span>
    )}
    </>
  );
}
