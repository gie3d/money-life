"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, day, money } from "@/lib/format";
import type { ForecastPoint } from "@/lib/forecast";

const NAMES: Record<string, string> = { actual: "Recorded", trend: "Trend", afterPlans: "After plan costs" };
const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

/** The recent months as recorded (solid), then the trend and the trend less plan costs (dashed), meeting at today. */
export default function ForecastChart({ points, today, currency, withPlans }: { points: ForecastPoint[]; today: string; currency: string; withPlans: boolean }) {
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-brand" />Recorded</li>
        <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-sky" />Trend</li>
        {withPlans && <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-miss" />After plan costs</li>}
      </ul>
      <div className="h-64 w-full" role="img" aria-label="Total value over the last months and forecast for the next six">
        <ResponsiveContainer>
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forecast-actual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => (d === today ? "Today" : month(d))} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={52} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
            <ReferenceLine x={today} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <Tooltip
              labelFormatter={(d) => (String(d) === today ? `Today, ${day(today)}` : day(String(d)))}
              formatter={(v, name) => [money(Number(v), currency), NAMES[String(name)] ?? String(name)]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
            />
            <Area type="linear" dataKey="actual" stroke="var(--brand)" strokeWidth={2.5} fill="url(#forecast-actual)" connectNulls={false} />
            <Line type="linear" dataKey="trend" stroke="var(--sky)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            {withPlans && <Line type="linear" dataKey="afterPlans" stroke="var(--miss)" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
