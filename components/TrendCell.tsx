import Sparkline from "./Sparkline";
import { compactMoney, day, pct } from "@/lib/format";
import type { Trend } from "@/lib/trend";

/** The small 6-month chart and the return beside it, for an asset or a group. Hidden on narrow screens unless `always`. */
export default function TrendCell({ trend, name, currency, always = false }: { trend: Trend | null; name: string; currency: string; always?: boolean }) {
  if (!trend) return <span className="text-ink-3">—</span>;
  const word = trend.tone === "up" ? "gain" : trend.tone === "down" ? "loss" : "no change";
  return (
    <div className={`${always ? "flex" : "hidden sm:flex"} shrink-0 items-center justify-end gap-2`} title={`Since ${day(trend.since)}`}>
      <Sparkline points={trend.points} width={124} height={40} startLabel={`${day(trend.since, false)} · ${compactMoney(trend.points[0]?.value ?? 0, currency)}`} currency={currency} balance={trend.balance} tone={trend.tone} label={`${name}, since ${day(trend.since)}: ${trend.balance ? (trend.tone === "up" ? "up" : trend.tone === "down" ? "down" : "no change") : word}${trend.returnPct !== null ? ` of ${pct(trend.returnPct)}` : ""}`} />
      {!trend.balance && (
        <span className={`num w-14 text-right text-xs font-semibold ${trend.tone === "up" ? "text-go-text" : trend.tone === "down" ? "text-miss-text" : "text-ink-3"}`}>
          {pct(trend.returnPct)}
        </span>
      )}
    </div>
  );
}
