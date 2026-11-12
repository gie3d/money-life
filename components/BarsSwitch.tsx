import { PeriodBars, type Bar } from "./SpendingCharts";

export type BarsView = { id: string; label: string; hint: string; bars: Bar[]; legend?: { label: string; color: string }[] };

/** Month-by-month bars stacked the way `view` says, e.g. by category or by must, need and want. */
export default function BarsSwitch({ title, views, view, selected, currency, average, averageLabel }: {
  title: string; views: BarsView[]; view: string; selected: string; currency: string; average?: number | null; averageLabel?: string;
}) {
  const v = views.find((x) => x.id === view) ?? views[0];
  return <PeriodBars title={title} hint={v.hint} bars={v.bars} selected={selected} currency={currency} average={average} averageLabel={averageLabel} legend={v.legend} />;
}
