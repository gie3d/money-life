"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, money, monthLabel } from "@/lib/format";

export type AllPlansRow = { month: string; balance: number; [planKey: string]: number | string };
export type AllPlansSeries = { key: string; name: string; color: string };

/** Every active plan's payments stacked by month, and the funds left once all of them are paid (the line). */
export default function AllPlansChart({ rows, series, currency }: { rows: AllPlansRow[]; series: AllPlansSeries[]; currency: string }) {
  const names = new Map<string, string>([["balance", "Funds left"], ...series.map((s): [string, string] => [s.key, s.name])]);
  return (
    <div className="h-80 w-full" role="img" aria-label="Payments each month for all plans, and the funds left after them">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis width={56} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <ReferenceLine y={0} stroke="var(--miss)" strokeDasharray="4 4" />
          <Tooltip
            labelFormatter={(m) => monthLabel(String(m))}
            formatter={(v, key) => [money(Number(v), currency), names.get(String(key)) ?? String(key)]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
          />
          <Legend formatter={(key) => names.get(String(key)) ?? String(key)} wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="plans" fill={s.color} radius={i === series.length - 1 ? [6, 6, 0, 0] : 0} isAnimationActive={false} />
          ))}
          <Line type="monotone" dataKey="balance" stroke="var(--ink)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
