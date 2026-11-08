import type { Point } from "@/lib/performance";

/**
 * A tiny line of an asset's value over time, as a plain SVG (no script). Values hold until the next record,
 * so the line steps rather than slopes, like the full charts. `tone` colours it: gain, loss or flat.
 */
export default function Sparkline({ points, tone, label, width = 96, height = 28 }: {
  points: Point[];
  tone: "up" | "down" | "flat";
  label: string;
  width?: number;
  height?: number;
}) {
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
  const x = (d: string) => ((t(d) - t0) / span) * width;
  const y = (v: number) => (hi === lo ? height / 2 : pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2));

  // Step after each point: across at the old value, then up or down to the new one.
  let d = `M0 ${y(points[0].value).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const px = x(points[i].date).toFixed(1);
    d += ` H${px} V${y(points[i].value).toFixed(1)}`;
  }
  const area = `${d} H${width} V${height} H0 Z`;
  const id = `spark-${label.replace(/[^a-z0-9]/gi, "").slice(0, 24)}-${Math.round(lo)}-${Math.round(hi)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
