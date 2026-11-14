"use client";

import { useState } from "react";
import AssetPicker from "./AssetPicker";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisDate, compactMoney, day, money, pct, spansYears, tone } from "@/lib/format";
import type { TrendAsset, TrendRow } from "@/lib/journal";

/**
 * How the money an entry is about moved over its period: one line for the total, or one per asset, with where it
 * started, ended, and its lowest and highest points.
 */
export default function JournalTrend({ rows, assets, from, to, everything, currency }: {
  rows: TrendRow[]; assets: TrendAsset[]; from: string; to: string; everything: boolean; currency: string;
}) {
  const [by, setBy] = useState<"total" | "asset">("total");
  const [shown, setShown] = useState(() => new Set(assets.map((a) => a.id)));
  const values = rows.map((r) => r.total);
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const change = first > 0 ? (last - first) / first : null;
  const long = spansYears(rows);
  const up = last >= first;
  const stat = (label: string, v: string, cls = "") => (
    <div className="flex items-baseline justify-between gap-3 py-2"><dt className="eyebrow">{label}</dt><dd className={`num text-base font-extrabold tracking-tight sm:text-lg ${cls}`}>{v}</dd></div>
  );

  return (
    <section className="card space-y-4 p-5 sm:p-8" aria-labelledby="money-trend">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="money-trend" className="text-lg">{everything ? "Your money" : "The assets this is about"}, {day(from)} to {day(to)}</h2>
          <p className="text-xs text-ink-3">From what was recorded in the period; a value holds until the next record.</p>
        </div>
        {assets.length > 1 && (
          <div role="group" aria-label="Chart lines" className="flex gap-1 rounded-full bg-surface-2 p-1">
            {([["total", "Total"], ["asset", "By asset"]] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={by === k} onClick={() => setBy(k)}
                className={`rounded-full px-3.5 py-1 text-sm font-semibold ${by === k ? "bg-ink text-surface" : "text-ink-3"}`}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {rows.length < 2 ? (
        <p className="py-10 text-center text-sm text-ink-3">Nothing was recorded for these assets in this period, so there is no line to draw.</p>
      ) : (
        <>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <dl className="divide-y divide-line border-y border-line">
              {stat("Start", money(first, currency))}
              {stat("End", money(last, currency))}
              {stat("Change", pct(change), tone(last - first))}
            </dl>
            <dl className="divide-y divide-line border-b border-line sm:border-t">
              {stat("High", money(high, currency))}
              {stat("Low", money(low, currency))}
              {stat("Diff", money(high - low, currency))}
            </dl>
          </div>
          <div className="h-72 w-full" role="img" aria-label={`Value from ${money(first, currency)} to ${money(last, currency)}, between ${money(low, currency)} and ${money(high, currency)}`}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => axisDate(d, long)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis width={76} tickFormatter={(n: number) => compactMoney(n, currency)} tick={{ fill: "var(--ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  labelFormatter={(d) => day(String(d))}
                  formatter={(v, name) => [money(Number(v), currency), name === "total" ? "Total" : assets.find((a) => `a${a.id}` === name)?.name ?? String(name)]}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
                />
                {by === "total"
                  ? <Line type="stepAfter" dataKey="total" stroke={up ? "var(--go)" : "var(--miss)"} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  : assets.filter((a) => shown.has(a.id)).map((a) => <Line key={a.id} type="stepAfter" dataKey={`a${a.id}`} stroke={a.color} strokeWidth={2} dot={false} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {by === "asset" && (
            <AssetPicker assets={assets} ticked={shown} setTicked={setShown} />
          )}
        </>
      )}
    </section>
  );
}
