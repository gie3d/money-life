"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SignGradient, signStroke, toned } from "./Sign";
import { RangeLabel, rangeBrush, useRange } from "./RangeBrush";
import { compactMoney, money, monthLabel } from "@/lib/format";

export type AllPlansRow = { month: string; balance: number; [planKey: string]: number | string };
export type AllPlansSeries = { key: string; name: string; color: string };

/** Every active plan's payments stacked by month, and the funds left once all of them are paid (the line). */
export default function AllPlansChart({ rows, series, currency }: { rows: AllPlansRow[]; series: AllPlansSeries[]; currency: string }) {
  const names = new Map<string, string>([["balance", "Funds left"], ...series.map((s): [string, string] => [s.key, s.name])]);
  const range = useRange(rows.length);
  return (
    <div>
    {rows.length > 1 && <RangeLabel from={monthLabel(rows[range.start].month)} to={monthLabel(rows[range.end].month)} range={range} length={rows.length} />}
    <div className="h-96 w-full" role="img" aria-label="Payments each month for all plans, and the funds left after them">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs><SignGradient id="all-plans-balance" values={rows.slice(range.start, range.end + 1).map((r) => r.balance)} /></defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis width={56} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <ReferenceLine y={0} stroke="var(--miss)" strokeDasharray="4 4" />
          <Tooltip
            labelFormatter={(m) => monthLabel(String(m))}
            formatter={(v, key) => [String(key) === "balance" ? toned(Number(v), currency) : money(Number(v), currency), names.get(String(key)) ?? String(key)]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
          />
          <Legend formatter={(key) => names.get(String(key)) ?? String(key)} wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="plans" fill={s.color} radius={i === series.length - 1 ? [6, 6, 0, 0] : 0} isAnimationActive={false} />
          ))}
          <Line type="monotone" dataKey="balance" stroke={signStroke("all-plans-balance", rows.slice(range.start, range.end + 1).map((r) => r.balance))} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          {rangeBrush({ rows, dataKey: "month", keys: ["balance"], range, format: monthLabel, type: "monotone" })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}
