"use client";

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisDate, compactMoney, day, spansYears, money } from "@/lib/format";
import { RangeLabel, rangeBrush, useRange } from "./RangeBrush";
import { RunGradient, runStroke, SignGradient, signStroke, toned } from "./Sign";
import FullscreenButton from "./FullscreenButton";
import TradingChart from "./TradingChart";
import type { Point } from "@/lib/performance";

const compact = compactMoney;

export default function NetWorthChart({ data, currency, title, showCost = false }: { data: Point[]; currency: string; title: string; showCost?: boolean }) {
  const range = useRange(data.length);
  if (data.length < 2) {
    return <p className="py-16 text-center text-sm text-ink-3">Add at least two dated values to see the line.</p>;
  }
  const long = spansYears(data);
  const seen = data.slice(range.start, range.end + 1);
  const paint = `worth-${showCost ? "inv" : "all"}`;
  // Against cost the colour says whether you are ahead (green) or behind (red); alone it follows the value itself.
  const stroke = showCost ? runStroke(paint, seen.map((p) => p.value), seen.map((p) => p.value - p.cost)) : signStroke(paint, seen.map((p) => p.value));
  return (
    <div className="relative">
      <div className="absolute right-0 top-0 z-10">
        <FullscreenButton title={title}>
          <TradingChart data={data} currency={currency} showCost={showCost} />
        </FullscreenButton>
      </div>
      <RangeLabel from={day(data[range.start].date)} to={day(data[range.end].date)} range={range} length={data.length} />
      <div className="h-80 w-full" role="img" aria-label={showCost ? "Current value over time against cost" : "Total value over time"}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {showCost ? <RunGradient id={paint} diffs={seen.map((p) => p.value - p.cost)} /> : <SignGradient id={paint} values={seen.map((p) => p.value)} />}
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => axisDate(d, long)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
          <YAxis width={52} tickFormatter={(n: number) => compact(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(d) => day(String(d))}
            formatter={(v, name, item) => [name === "value" ? toned(Number(v), currency, showCost ? Number(v) - Number((item.payload as { cost?: number }).cost ?? 0) : undefined) : money(Number(v), currency), name === "value" ? "Current value" : "Cost"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
          />
          <Area type="stepAfter" dataKey="value" stroke={stroke} strokeWidth={2.5} fill={`url(#${paint})`} fillOpacity={0.18} />
          {showCost && <Line type="stepAfter" dataKey="cost" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
          {rangeBrush({ rows: data, dataKey: "date", keys: showCost ? ["value", "cost"] : ["value"], range, format: (d) => day(d), type: "stepAfter" })}
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
