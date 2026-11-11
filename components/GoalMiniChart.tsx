"use client";

import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GoalTooltip } from "./GoalChart";
import { axisDate, compactMoney } from "@/lib/format";

export type MiniPoint = { date: string; planned: number; actual: number | null; projected: number | null };

/** Round a bound outward to a tidy step (about 5% of its size), so the axis hugs the lines instead of starting at zero. */
function nice(n: number, dir: 1 | -1) {
  const step = 10 ** Math.floor(Math.log10(Math.max(Math.abs(n), 1))) / 2;
  return (dir === 1 ? Math.ceil(n / step) : Math.floor(n / step)) * step;
}

/** A small, quiet chart for the home page: the plan (dashed), your actual value (solid) and carrying on from today (dotted). */
export default function GoalMiniChart({ points, today, currency, label }: { points: MiniPoint[]; today: string; currency: string; label: string }) {
  return (
    <div className="h-40 w-full" role="img" aria-label={label}>
      <ResponsiveContainer>
        <ComposedChart data={points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => axisDate(d, true)} tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis width={48} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} domain={[(min: number) => nice(min, -1), (max: number) => nice(max, 1)]} />
          <Tooltip content={<GoalTooltip currency={currency} />} />
          <Line type="linear" dataKey="planned" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="actual" stroke="var(--brand)" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="projected" stroke="var(--brand)" strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" dot={false} isAnimationActive={false} />
          <ReferenceLine x={today} stroke="var(--ink-3)" strokeDasharray="2 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
