"use client";

import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from "recharts";
import { axisDate, compactMoney, day, money } from "@/lib/format";

export type GoalPoint = { date: string; planned: number | null; actual: number | null; projected: number | null };
const NAMES: Record<string, string> = { planned: "Plan", actual: "Actual", projected: "Carrying on as planned" };

/** The plan (dashed), what actually happened (solid), and where carrying on as planned from today leads (dotted). */
export default function GoalChart({ points, target, today, currency }: { points: GoalPoint[]; target: number; today: string; currency: string }) {
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-brand" />Actual</li>
        <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-ink-3" />Plan</li>
        <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dotted border-sky" />Carrying on as planned</li>
        <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-go" />Target</li>
      </ul>
      <div className="h-72 w-full" role="img" aria-label="The goal's plan against what actually happened, with the target">
        <ResponsiveContainer>
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="goal-actual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => axisDate(d, true)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis width={56} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, "auto"]} />
            <ReferenceLine y={target} stroke="var(--go)" strokeWidth={1.5} />
            <ReferenceLine x={today} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <Tooltip
              labelFormatter={(d) => day(String(d))}
              formatter={(v, name) => [money(Number(v), currency), NAMES[String(name)] ?? String(name)]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
            />
            <Line type="linear" dataKey="planned" stroke="var(--ink-3)" strokeWidth={1.75} strokeDasharray="5 4" dot={false} />
            <Area type="linear" dataKey="actual" stroke="var(--brand)" strokeWidth={2.5} fill="url(#goal-actual)" connectNulls={false} />
            <Line type="linear" dataKey="projected" stroke="var(--sky)" strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
