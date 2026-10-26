"use client";

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { day, money } from "@/lib/format";
import type { Point } from "@/lib/performance";

const compact = (n: number, c: string) => money(n, c, { notation: "compact", maximumFractionDigits: 1 });

export default function NetWorthChart({ data, currency, showInvested = false }: { data: Point[]; currency: string; showInvested?: boolean }) {
  if (data.length < 2) {
    return <p className="py-16 text-center text-sm text-ink-3">Add at least two dated values to see the line.</p>;
  }
  return (
    <div className="h-64 w-full" role="img" aria-label={showInvested ? "Value over time against money paid in" : "Total value over time"}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`worth-${showInvested ? "inv" : "all"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => day(d, false)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
          <YAxis width={52} tickFormatter={(n: number) => compact(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(d) => day(String(d))}
            formatter={(v, name) => [money(Number(v), currency), name === "value" ? "Worth" : "Paid in"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
          />
          <Area type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2.5} fill={`url(#worth-${showInvested ? "inv" : "all"})`} />
          {showInvested && <Line type="monotone" dataKey="invested" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
