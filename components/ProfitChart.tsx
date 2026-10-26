"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, day, signedMoney } from "@/lib/format";
import type { Point } from "@/lib/performance";
import FullscreenButton from "./FullscreenButton";
import TradingChart from "./TradingChart";

const compact = compactMoney;

/** Profit (value minus cost) against date: green above zero, red below. */
export default function ProfitChart({ data, currency, title }: { data: Point[]; currency: string; title: string }) {
  if (data.length < 2) {
    return <p className="py-16 text-center text-sm text-ink-3">Add a second trade or price to see profit over time.</p>;
  }
  const rows = data.map((p) => ({ date: p.date, profit: p.value - p.cost }));
  const hi = Math.max(...rows.map((r) => r.profit));
  const lo = Math.min(...rows.map((r) => r.profit));
  // Where zero falls in the plotted range, so the colour flips exactly at the zero line.
  const zero = hi <= 0 ? 0 : lo >= 0 ? 1 : hi / (hi - lo);

  return (
    <div className="relative">
      <div className="absolute right-0 top-0 z-10">
        <FullscreenButton title={title}>
          <TradingChart data={data} currency={currency} profit />
        </FullscreenButton>
      </div>
      <div className="h-64 w-full" role="img" aria-label="Profit over time">
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="profit-split" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zero} stopColor="var(--go)" />
                <stop offset={zero} stopColor="var(--miss)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => day(d, false)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis width={52} tickFormatter={(n: number) => compact(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={[Math.min(lo, 0), Math.max(hi, 0)]} />
            <ReferenceLine y={0} stroke="var(--ink-3)" />
            <Tooltip
              labelFormatter={(d) => day(String(d))}
              formatter={(v) => [signedMoney(Number(v), currency), "Profit"]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
            />
            <Area type="stepAfter" dataKey="profit" stroke="url(#profit-split)" strokeWidth={2.5} fill="url(#profit-split)" fillOpacity={0.18} baseValue={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
