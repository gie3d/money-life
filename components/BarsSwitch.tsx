"use client";

import { useState } from "react";
import { PeriodBars, type Bar } from "./SpendingCharts";

export type BarsView = { id: string; label: string; hint: string; bars: Bar[]; legend?: { label: string; color: string }[] };

/** Month-by-month bars with a switch between ways of stacking them, e.g. by category or by must, need and want. */
export default function BarsSwitch({ title, views, selected, currency, average, averageLabel }: {
  title: string; views: BarsView[]; selected: string; currency: string; average?: number | null; averageLabel?: string;
}) {
  const [id, setId] = useState(views[0].id);
  const view = views.find((v) => v.id === id) ?? views[0];
  const switcher = (
    <div role="group" aria-label="Stack the bars by" className="inline-flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
      {views.map((v) => (
        <button key={v.id} type="button" aria-pressed={v.id === view.id} onClick={() => setId(v.id)}
          className={`rounded-full px-3 py-1 ${v.id === view.id ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}>
          {v.label}
        </button>
      ))}
    </div>
  );
  return <PeriodBars title={title} hint={view.hint} bars={view.bars} selected={selected} currency={currency} average={average} averageLabel={averageLabel} action={switcher} legend={view.legend} />;
}
