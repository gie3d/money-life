"use client";

import { AreaSeries, BaselineSeries, ColorType, createChart, LineSeries, LineStyle, type Time } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { compactMoney, day, money } from "@/lib/format";
import { resample, type Point, type Unit } from "@/lib/performance";

const compact = compactMoney;

/** TradingView's open-source Lightweight Charts, filling its parent. Used for the full-screen view. */
export default function TradingChart({ data, currency, showCost = false, profit = false }: { data: Point[]; currency: string; showCost?: boolean; profit?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [unit, setUnit] = useState<Unit>("day");

  // Only ever rendered after the person opens it, so reading the clock here cannot mismatch the server.
  const points = useMemo(() => {
    const n = new Date();
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    return resample(profit ? data.map((p) => ({ date: p.date, value: p.value - p.cost, cost: 0 })) : data, unit, today);
  }, [data, unit, profit]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // Read the theme from the page's own variables, so the chart matches light and dark.
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: v("--surface") }, textColor: v("--ink-3"), fontFamily: css.fontFamily || "system-ui" },
      grid: { vertLines: { color: v("--line") }, horzLines: { color: v("--line") } },
      rightPriceScale: { borderColor: v("--line") },
      timeScale: { borderColor: v("--line"), timeVisible: false },
      localization: { priceFormatter: (p: number) => compact(p, currency) },
    });

    if (profit) {
      const up = v("--go");
      const down = v("--miss");
      const series = chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: 0 },
        topLineColor: up, topFillColor1: `${up}55`, topFillColor2: `${up}08`,
        bottomLineColor: down, bottomFillColor1: `${down}08`, bottomFillColor2: `${down}55`,
        lineWidth: 3, priceLineVisible: false,
      });
      series.setData(points.map((p) => ({ time: p.date as Time, value: p.value })));
    } else {
      const brand = v("--brand");
      const worth = chart.addSeries(AreaSeries, { lineColor: brand, topColor: `${brand}55`, bottomColor: `${brand}00`, lineWidth: 3, priceLineVisible: false });
      worth.setData(points.map((p) => ({ time: p.date as Time, value: p.value })));
    }

    if (showCost) {
      const cost = chart.addSeries(LineSeries, { color: v("--ink-2"), lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false });
      cost.setData(points.map((p) => ({ time: p.date as Time, value: p.cost })));
    }
    chart.timeScale().fitContent();

    const byDate = new Map(points.map((p) => [p.date, p]));
    chart.subscribeCrosshairMove((e) => setHover(typeof e.time === "string" ? (byDate.get(e.time) ?? null) : null));

    return () => chart.remove();
  }, [points, currency, showCost, profit]);

  const shown = hover ?? points[points.length - 1];

  return (
    <div className="flex h-full min-h-72 w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div role="group" aria-label="Chart step" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["day", "month", "year"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => { setUnit(u); setHover(null); }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${unit === u ? "bg-ink text-surface" : "text-ink-3"}`}
            >
              {u}
            </button>
          ))}
        </div>
        <ul className="flex gap-4 text-sm text-ink-2">
          {profit ? (
            <>
              <li className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-go" />Profit</li>
              <li className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-miss" />Loss</li>
            </>
          ) : (
            <li className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-brand" />{showCost ? "Current value" : "Value"}</li>
          )}
          {showCost && <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-ink-2" />Cost</li>}
        </ul>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" role="img" aria-label={profit ? "Profit over time" : showCost ? "Current value over time against cost" : "Total value over time"} />
        {shown && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl border border-line bg-surface/90 px-3 py-2 text-sm">
            <p className="eyebrow">{day(shown.date)}</p>
            <p className={`num font-bold ${profit ? (shown.value > 0 ? "text-go-text" : shown.value < 0 ? "text-miss-text" : "") : ""}`}>
              {profit && shown.value > 0 ? "+" : ""}{money(shown.value, currency)}
            </p>
            {showCost && <p className="num text-xs text-ink-3">Cost {money(shown.cost, currency)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
