"use client";

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, day, money } from "@/lib/format";
import FullscreenButton from "./FullscreenButton";
import TradingChart from "./TradingChart";
import type { Point } from "@/lib/performance";

const compact = compactMoney;

export default function NetWorthChart({ data, currency, title, showCost = false }: { data: Point[]; currency: string; title: string; showCost?: boolean }) {
  if (data.length < 2) {
    return <p className="py-16 text-center text-sm text-ink-3">Add at least two dated values to see the line.</p>;
  }
  return (
    <div className="relative">
      <div className="absolute right-0 top-0 z-10">
        <FullscreenButton title={title}>
          <TradingChart data={data} currency={currency} showCost={showCost} />
        </FullscreenButton>
      </div>
      <div className="h-64 w-full" role="img" aria-label={showCost ? "Current value over time against cost" : "Total value over time"}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`worth-${showCost ? "inv" : "all"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => day(d, false)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
          <YAxis width={52} tickFormatter={(n: number) => compact(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(d) => day(String(d))}
            formatter={(v, name) => [money(Number(v), currency), name === "value" ? "Current value" : "Cost"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
          />
          <Area type="stepAfter" dataKey="value" stroke="var(--brand)" strokeWidth={2.5} fill={`url(#worth-${showCost ? "inv" : "all"})`} />
          {showCost && <Line type="stepAfter" dataKey="cost" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
