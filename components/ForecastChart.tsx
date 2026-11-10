"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, day, money } from "@/lib/format";
import { SignGradient, signStroke, signSwatch, toned } from "./Sign";
import { RangeLabel, rangeBrush, useRange } from "./RangeBrush";
import type { ForecastPoint } from "@/lib/forecast";

const NAMES: Record<string, string> = { actual: "Recorded", trend: "Trend", afterPlans: "After plan costs" };
const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

/** The recent months as recorded (solid), then the trend and the trend less plan costs (dashed), meeting at today. */
export default function ForecastChart({ points, today, currency, withPlans }: { points: ForecastPoint[]; today: string; currency: string; withPlans: boolean }) {
  const range = useRange(points.length);
  const name = (d: string) => (d === today ? "Today" : month(d));
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-2"><span className={`h-1 w-5 rounded-full ${signSwatch}`} />Recorded</li>
        <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-go" />Trend</li>
        {withPlans && <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dotted border-brand" />After plan costs</li>}
      </ul>
      <RangeLabel from={day(points[range.start].date)} to={day(points[range.end].date)} range={range} length={points.length} />
      <div className="h-80 w-full" role="img" aria-label="Total value over the last twelve months and forecast for the next twelve">
        <ResponsiveContainer>
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {(["actual"] as const).map((k) => (
                <SignGradient key={k} id={`forecast-${k}`} values={points.slice(range.start, range.end + 1).map((p) => p[k])} />
              ))}
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => (d === today ? "Today" : month(d))} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={52} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
            <ReferenceLine x={today} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <Tooltip
              labelFormatter={(d) => (String(d) === today ? `Today, ${day(today)}` : day(String(d)))}
              formatter={(v, name) => [String(name) === "actual" ? toned(Number(v), currency) : money(Number(v), currency), NAMES[String(name)] ?? String(name)]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
            />
            <Area type="linear" dataKey="actual" stroke={signStroke("forecast-actual", points.slice(range.start, range.end + 1).map((p) => p.actual))} strokeWidth={2.5} fill="url(#forecast-actual)" fillOpacity={0.18} connectNulls={false} />
            <Line type="linear" dataKey="trend" stroke="var(--go)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            {withPlans && <Line type="linear" dataKey="afterPlans" stroke="var(--brand)" strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" dot={false} />}
            {rangeBrush({ rows: points, dataKey: "date", keys: withPlans ? ["actual", "trend", "afterPlans"] : ["actual", "trend"], range, format: name })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
