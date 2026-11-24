"use client";

import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, day, money } from "@/lib/format";
import { SignGradient, signStroke, signSwatch, toned } from "./Sign";
import { RangeLabel, rangeBrush, useRange } from "./RangeBrush";
import type { ForecastPoint, LayerRow } from "@/lib/forecast";

const NAMES: Record<string, string> = { actual: "Recorded", trend: "Trend", afterPlans: "After plans", range: "Likely range" };
const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

/** The recent months as recorded (solid), then the trend and the trend less plan costs (dashed), meeting at today. */
export default function ForecastChart({ points, layerRows, layers, today, currency, withPlans, withBand }: {
  withBand: boolean; points: ForecastPoint[]; layerRows: LayerRow[]; layers: { id: string; name: string; color: string }[]; today: string; currency: string; withPlans: boolean;
}) {
  const [stacked, setStacked] = useState(false);
  const range = useRange(points.length);
  // The stacked view carries the plans line on the same rows, so it can sit over the layers.
  const rows = stacked
    ? layerRows.map((r, i) => ({ ...r, afterPlans: points[i].afterPlans }))
    : points.map((p) => ({ ...p, range: p.low !== null && p.high !== null ? [p.low, p.high] : null }));
  const name = (d: string) => (d === today ? "Today" : month(d));
  return (
    <div className="space-y-3">
      <nav role="group" aria-label="Chart view" className="inline-flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
        {([[false, "Total"], [true, "By category"]] as const).map(([v, label]) => (
          <button key={label} type="button" aria-pressed={stacked === v} onClick={() => setStacked(v)}
            className={`rounded-full px-3 py-1 ${stacked === v ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}>{label}</button>
        ))}
      </nav>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {stacked && layers.map((l) => <li key={l.id} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: l.color }} />{l.name}</li>)}
        {!stacked && <li className="flex items-center gap-2"><span className={`h-1 w-5 rounded-full ${signSwatch}`} />Recorded</li>}
        {!stacked && <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-go" />Trend</li>}
        {withPlans && <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dotted border-sky" />After plans</li>}
        {!stacked && withBand && <li className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-brand/20" />Likely range</li>}
      </ul>
      <RangeLabel from={day(points[range.start].date)} to={day(points[range.end].date)} range={range} length={points.length} />
      <div className="h-80 w-full" role="img" aria-label="Total value as recorded and the forecast ahead">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              formatter={(v, name) => [
                Array.isArray(v) ? `${money(Number(v[0]), currency)} – ${money(Number(v[1]), currency)}` : String(name) === "actual" ? toned(Number(v), currency) : money(Number(v), currency),
                NAMES[String(name)] ?? String(name),
              ]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
            />
            {stacked && layers.map((l) => <Area key={l.id} type="linear" dataKey={l.id} name={l.name} stackId="cat" stroke={l.color} strokeWidth={1.5} fill={l.color} fillOpacity={0.35} />)}
            {!stacked && withBand && <Area type="linear" dataKey="range" stroke="none" fill="var(--brand)" fillOpacity={0.14} connectNulls={false} activeDot={false} />}
            {!stacked && <Area type="linear" dataKey="actual" stroke={signStroke("forecast-actual", points.slice(range.start, range.end + 1).map((p) => p.actual))} strokeWidth={2.5} fill="url(#forecast-actual)" fillOpacity={0.18} connectNulls={false} />}
            {!stacked && <Line type="linear" dataKey="trend" stroke="var(--go)" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
            {withPlans && <Line type="linear" dataKey="afterPlans" stroke="var(--sky)" strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" dot={false} />}
            {rangeBrush({ rows: points, dataKey: "date", keys: withPlans ? ["actual", "trend", "afterPlans"] : ["actual", "trend"], range, format: name })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
