import { extendTo, netWorthSeries, periodStart, totalPerformance, type Point } from "./performance.ts";
import type { Entry } from "./types.ts";

export type Trend = { points: Point[]; tone: "up" | "down" | "flat"; returnPct: number | null; since: string };

/**
 * The last 6 months of one asset or a group of them, for a small chart: their combined value from 6 months ago (or
 * their first record, if newer) to today, coloured by how they performed with money put in or taken out set aside.
 */
export function sixMonthTrend(lists: Entry[][], today: string): Trend | null {
  const kept = lists.filter((l) => l.length > 0);
  if (kept.length === 0) return null;
  const from = periodStart("6M", today)!;
  const first = kept.map((l) => l[0].date).sort()[0];
  const start = first > from ? null : from;
  const points = extendTo(netWorthSeries(kept, start, today), today);
  const perf = totalPerformance(kept, start ?? first, today);
  const tone = Math.abs(perf.gain) < 0.005 ? "flat" : perf.gain > 0 ? "up" : "down";
  return { points, tone, returnPct: perf.returnPct, since: start ?? first };
}
