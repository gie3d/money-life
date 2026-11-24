"use client";

import { useCallback, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DatePicker from "./DatePicker";
import Segmented from "./Segmented";
import { compactMoney, day, money } from "@/lib/format";

/** One group (a category or a liquidity group) to stack. */
export type AllocationSeries = { id: string; label: string; color: string };
/** One point in time: its date and each group's value then, keyed by the group's id. */
export type AllocationPoint = { date: string } & Record<string, number | string>;
type View = { series: AllocationSeries[]; points: AllocationPoint[] };

const PRESETS = [
  { id: "6m", label: "6M", months: 6 },
  { id: "1y", label: "1Y", months: 12 },
  { id: "3y", label: "3Y", months: 36 },
  { id: "5y", label: "5Y", months: 60 },
];

const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const monthsBefore = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};
/** Where a group's value is kept on a row in the Share view, whose own key holds its percentage. */
const raw = (id: string) => `${id}:value`;

/**
 * How the allocation has moved over time: each group's value stacked at the end of every month, then today.
 * "Share" turns every month into percentages of its total, so the stack is always 100% and a group growing faster
 * than the rest widens its band. A quick window (6M, 1Y…) or any From–To dates picks the months shown.
 */
export default function AllocationChart({ byCategory, byLiquidity, currency, today }: { byCategory: View; byLiquidity: View; currency: string; today: string }) {
  const [by, setBy] = useState<"category" | "liquidity">("category");
  const [as, setAs] = useState<"value" | "share">("share");
  const { series, points } = by === "category" ? byCategory : byLiquidity;
  const first = points[0]?.date ?? today;

  // The window: a preset ending today, or dates picked. A preset remounts the pickers so they show its dates.
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(today);
  const [pickerKey, setPickerKey] = useState(0);
  const choose = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setFrom(p ? monthsBefore(today, p.months) : first);
    setTo(today);
    setPickerKey((k) => k + 1);
  };
  const pickFrom = useCallback((d: string) => setFrom((old) => { if (old !== d) setPreset(""); return d; }), []);
  const pickTo = useCallback((d: string) => setTo((old) => { if (old !== d) setPreset(""); return d; }), []);
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  // The months inside, opened by the value as it stood on the first day (the last month end before it).
  const before = points.filter((p) => p.date < lo).at(-1);
  const shown = [...(before ? [{ ...before, date: lo }] : []), ...points.filter((p) => p.date >= lo && p.date <= hi)];
  const presets = PRESETS.filter((p) => monthsBefore(today, p.months) > first);

  const totalOf = (p: AllocationPoint) => series.reduce((s, x) => s + Number(p[x.id] ?? 0), 0);
  const rows = as === "value" ? shown : shown.map((p) => {
    const total = totalOf(p);
    const row: AllocationPoint = { date: p.date };
    for (const x of series) {
      row[x.id] = total > 0 ? (Number(p[x.id] ?? 0) / total) * 100 : 0;
      row[raw(x.id)] = Number(p[x.id] ?? 0);
    }
    return row;
  });
  const valueOf = (row: AllocationPoint, id: string) => Number(as === "share" ? row[raw(id)] : row[id]) || 0;

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-lg">Allocation over time</h2>
          <p className="text-xs text-ink-3">
            {as === "share" ? "Each group's share of your total" : "What each group was worth"} at the end of every month, then today.
          </p>
        </div>
        <Segmented label="Allocation over time by" value={by} onChange={(v) => setBy(v as typeof by)}
          options={[{ id: "category", label: "Category" }, { id: "liquidity", label: "Liquidity" }]} />
        <Segmented label="Show as" value={as} onChange={(v) => setAs(v as typeof as)}
          options={[{ id: "share", label: "Share %" }, { id: "value", label: "Value" }]} />
      </div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {series.map((s) => <li key={s.id} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.label}</li>)}
      </ul>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-44 space-y-1">
          <span className="eyebrow">From</span>
          <DatePicker key={`from-${pickerKey}`} name="allocation-from" label="From" defaultValue={from} onChange={pickFrom} />
        </div>
        <div className="w-44 space-y-1">
          <span className="eyebrow">To</span>
          <DatePicker key={`to-${pickerKey}`} name="allocation-to" label="To" defaultValue={to} onChange={pickTo} />
        </div>
        <div className="ml-auto pb-1">
          <Segmented label="Show the last" value={preset} onChange={choose}
            options={[...presets.map(({ id, label }) => ({ id, label })), { id: "all", label: "All" }]} />
        </div>
      </div>
      {rows.length < 2 ? (
        <p className="py-8 text-center text-sm text-ink-3">
          {points.length < 2 ? "There will be a chart once you have more than a month of records." : "Nothing to show between these dates: pick a wider range."}
        </p>
      ) : (
        <div className="h-80 w-full" role="img" aria-label={`Allocation by ${by} over time, as ${as === "share" ? "a share of the total" : "values"}`}>
          <ResponsiveContainer>
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => (d === today ? "Today" : month(d))} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              {as === "share" ? (
                <YAxis width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(n: number) => `${n}%`} />
              ) : (
                <YAxis width={56} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(n: number) => compactMoney(n, currency)} />
              )}
              <Tooltip
                labelFormatter={(d) => (String(d) === today ? `Today, ${day(today)}` : day(String(d)))}
                formatter={(_, name, item) => {
                  const row = item.payload as AllocationPoint;
                  const id = String(item.dataKey);
                  const v = valueOf(row, id);
                  const total = series.reduce((s, x) => s + valueOf(row, x.id), 0);
                  return [`${money(v, currency)}${total > 0 ? ` · ${((v / total) * 100).toFixed(1)}%` : ""}`, String(name)];
                }}
                itemSorter={(item) => -Number(item.value ?? 0)}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
              />
              {series.map((s) => (
                <Area key={s.id} type="linear" dataKey={s.id} name={s.label} stackId="alloc" stroke={s.color} strokeWidth={1.5} fill={s.color} fillOpacity={0.55} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
