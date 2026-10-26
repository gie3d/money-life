"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, money, monthLabel } from "@/lib/format";
import type { MonthRow } from "@/lib/plan";

/** Spending each month (bars) and the funds left after it (line). Below the zero line the plan can't be paid. */
export default function PlanChart({ rows, currency }: { rows: MonthRow[]; currency: string }) {
  const data = rows.map((r) => ({ month: r.month, spend: r.spend, balance: r.balance }));
  return (
    <div className="h-72 w-full" role="img" aria-label="Spending each month and the funds left after it">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis width={56} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <ReferenceLine y={0} stroke="var(--miss)" strokeDasharray="4 4" />
          <Tooltip
            labelFormatter={(m) => monthLabel(String(m))}
            formatter={(v, name) => [money(Number(v), currency), name === "spend" ? "To pay" : "Funds left"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
          />
          <Bar dataKey="spend" fill="var(--brand)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          <Line type="monotone" dataKey="balance" stroke="var(--ink)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
