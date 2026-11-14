import { extendTo, netWorthSeries, periodStart, totalPerformance, type Point } from "./performance.ts";
import type { Entry } from "./types.ts";

export type Trend = { points: Point[]; tone: "up" | "down" | "flat"; returnPct: number | null; /** A plain balance (cash, savings): the change is shown as an amount only, with no return. */ balance?: boolean; /** What it gained or lost over the same span, money moved in or out set aside. */ gain: number; /** The date the chart, the percentage and the gain all start from. */ since: string };

/**
 * The last 6 months of cash or savings, for a small chart: the balance itself, and how much it changed. A balance moves
 * with spending and deposits, so it has no return to speak of. A group starts on the first day every account in it has
 * a record, so accounts added to the app later don't read as the balance jumping from nothing.
 */
export function balanceTrend(lists: Entry[][], today: string): Trend | null {
  const kept = lists
    .map((l) => { const i = l.findIndex((e) => e.value !== 0 || e.contribution !== 0); return i < 0 ? l : l.slice(i); })
    .filter((l) => l.length > 0);
  if (kept.length === 0) return null;
  const from = periodStart("6M", today)!;
  const latestFirst = kept.map((l) => l[0].date).sort().at(-1)!;
  const start = latestFirst > from ? latestFirst : from;
  const points = extendTo(netWorthSeries(kept, start, today), today);
  if (points.length === 0) return null;
  const gain = points.at(-1)!.value - points[0].value;
  return { points, tone: Math.abs(gain) < 0.005 ? "flat" : gain > 0 ? "up" : "down", returnPct: null, balance: true, gain, since: points[0].date };
}

/**
 * The last 6 months of one asset or a group of them, for a small chart: their combined value from 6 months ago (or
 * their first record, if newer) to today. With `amount`, the change is the change in what is held, with no return. The line is the value itself, so coins sent to another wallet show as a drop;
 * its colour, and the return and gain beside it, are how they performed with money put in or taken out set aside.
 */
export function sixMonthTrend(lists: Entry[][], today: string, amount = false): Trend | null {
  // Records from before an asset held anything (priced, but nothing bought or transferred in yet) don't start its trend.
  const kept = lists
    .map((l) => { const i = l.findIndex((e) => e.value !== 0 || e.contribution !== 0); return i < 0 ? l : l.slice(i); })
    .filter((l) => l.length > 0);
  if (kept.length === 0) return null;
  const from = periodStart("6M", today)!;
  const first = kept.map((l) => l[0].date).sort()[0];
  const start = first > from ? null : from;
  const points = extendTo(netWorthSeries(kept, start, today), today);
  if (amount) {
    // An amount held (BTC in a wallet): the line and the change beside it are how much it holds, whatever moved it.
    const gain = points.length > 0 ? points.at(-1)!.value - points[0].value : 0;
    return { points, tone: Math.abs(gain) < 1e-9 ? "flat" : gain > 0 ? "up" : "down", returnPct: null, balance: true, gain, since: points[0]?.date ?? first };
  }
  const perf = totalPerformance(kept, start ?? first, today);
  const tone = Math.abs(perf.gain) < 0.005 ? "flat" : perf.gain > 0 ? "up" : "down";
  return { points, tone, returnPct: perf.returnPct, gain: perf.gain, since: start ?? first };
}
