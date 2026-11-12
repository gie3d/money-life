import Sparkline from "./Sparkline";
import { day, pct } from "@/lib/format";
import type { Trend } from "@/lib/trend";

/** The small 6-month chart and the return beside it, for an asset or a group. Hidden on narrow screens unless `always`. */
export default function TrendCell({ trend, name, always = false }: { trend: Trend | null; name: string; always?: boolean }) {
  if (!trend) return <span className="text-ink-3">—</span>;
  const word = trend.tone === "up" ? "gain" : trend.tone === "down" ? "loss" : "no change";
  return (
    <div className={`${always ? "flex" : "hidden sm:flex"} shrink-0 items-center justify-end gap-2`} title={`Since ${day(trend.since)}`}>
      <span className="num w-12 text-right text-[10px] leading-tight text-ink-3">{day(trend.since, false)}</span>
      <Sparkline points={trend.points} tone={trend.tone} label={`${name}, since ${day(trend.since)}: ${word}${trend.returnPct !== null ? ` of ${pct(trend.returnPct)}` : ""}`} />
      <span className={`num w-14 text-right text-xs font-semibold ${trend.tone === "up" ? "text-go-text" : trend.tone === "down" ? "text-miss-text" : "text-ink-3"}`}>
        {pct(trend.returnPct)}
      </span>
    </div>
  );
}
