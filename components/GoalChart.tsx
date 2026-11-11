"use client";

import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from "recharts";
import { SignGradient, signStroke, signSwatch } from "./Sign";
import { RangeLabel, rangeBrush, useRange } from "./RangeBrush";
import { axisDate, day, compactMoney, dayWithAge, money, pct, signedMoney, tone } from "@/lib/format";

export type GoalPoint = { date: string; planned: number | null; actual: number | null; projected: number | null };
const NAMES: Record<string, string> = { planned: "Plan", actual: "Actual", projected: "Carrying on as planned" };
const COLORS: Record<string, string> = { planned: "var(--ink-3)", actual: "var(--brand)", projected: "var(--sky)" };

/** The hover box: each line's value, then how far the actual (or, from today on, the projection) is from the plan. */
export function GoalTooltip({ active, payload, currency, birthDate }: {
  active?: boolean; payload?: { payload: GoalPoint }[]; currency: string; birthDate?: string | null;
}) {
  const pt = payload?.[0]?.payload;
  if (!active || !pt) return null;
  const lines = (["actual", "planned", "projected"] as const).filter((k) => pt[k] !== null);
  const against = pt.actual !== null ? pt.actual : pt.projected;
  const diff = against !== null && pt.planned !== null ? against - pt.planned : null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink shadow-lg">
      <p className="mb-1.5">{dayWithAge(pt.date, birthDate)}</p>
      {lines.map((k) => (
        <p key={k} className={`num flex justify-between gap-6 ${k === "planned" ? "" : tone(pt[k]!)}`} style={k === "planned" ? { color: COLORS[k] } : undefined}>
          <span>{NAMES[k]}</span><span>{money(pt[k]!, currency)}</span>
        </p>
      ))}
      {diff !== null && pt.planned !== null && Math.abs(diff) >= 0.005 && (
        <p className={`num mt-1.5 flex justify-between gap-6 border-t border-line pt-1.5 font-semibold ${tone(diff)}`}>
          <span>{pt.actual !== null ? "Difference from plan" : "Projected vs plan"}</span>
          <span>{signedMoney(diff, currency)}{pt.planned > 0 && ` · ${pct(diff / pt.planned)}`}</span>
        </p>
      )}
    </div>
  );
}

/** The plan (dashed), what actually happened (solid), and where carrying on as planned from today leads (dotted). */
export default function GoalChart({ points, target, today, currency, birthDate }: {
  points: GoalPoint[]; target: number; today: string; currency: string;
  /** Shown as an age next to each date on hover, for a retirement goal. */
  birthDate?: string | null;
}) {
  const range = useRange(points.length);
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-2"><span className={`h-1 w-5 rounded-full ${signSwatch}`} />Actual</li>
        <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-ink-3" />Plan</li>
        <li className="flex items-center gap-2"><span className={`h-0.5 w-5 ${signSwatch}`} />Carrying on as planned</li>
        <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-go" />Target</li>
      </ul>
      <RangeLabel from={day(points[range.start].date)} to={day(points[range.end].date)} range={range} length={points.length} />
      <div className="h-96 w-full" role="img" aria-label="The goal's plan against what actually happened, with the target">
        <ResponsiveContainer>
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {(["actual", "projected"] as const).map((k) => (
                <SignGradient key={k} id={`goal-${k}`} values={points.slice(range.start, range.end + 1).map((p) => p[k])} />
              ))}
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => axisDate(d, true)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis width={56} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, "auto"]} />
            <ReferenceLine y={target} stroke="var(--go)" strokeWidth={1.5} />
            <ReferenceLine x={today} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <Tooltip content={<GoalTooltip currency={currency} birthDate={birthDate} />} />
            <Line type="linear" dataKey="planned" stroke="var(--ink-3)" strokeWidth={1.75} strokeDasharray="5 4" dot={false} />
            <Area type="linear" dataKey="actual" stroke={signStroke("goal-actual", points.slice(range.start, range.end + 1).map((p) => p.actual))} strokeWidth={2.5} fill="url(#goal-actual)" fillOpacity={0.18} connectNulls={false} />
            <Line type="linear" dataKey="projected" stroke={signStroke("goal-projected", points.slice(range.start, range.end + 1).map((p) => p.projected))} strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" dot={false} />
            {rangeBrush({ rows: points, dataKey: "date", keys: ["planned", "actual", "projected"], range, format: (d) => axisDate(d, true) })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
