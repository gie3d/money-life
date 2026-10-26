import type { Entry } from "./types";

export type Period = "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "YTD", label: "YTD" },
  { id: "1Y", label: "1Y" },
  { id: "ALL", label: "All" },
];

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** First day of the window ending on `today`, or null for "everything". */
export function periodStart(period: Period, today: string): string | null {
  const d = new Date(`${today}T00:00:00Z`);
  switch (period) {
    case "1M": d.setUTCMonth(d.getUTCMonth() - 1); break;
    case "3M": d.setUTCMonth(d.getUTCMonth() - 3); break;
    case "6M": d.setUTCMonth(d.getUTCMonth() - 6); break;
    case "1Y": d.setUTCFullYear(d.getUTCFullYear() - 1); break;
    case "YTD": return `${d.getUTCFullYear()}-01-01`;
    case "ALL": return null;
  }
  return iso(d.getTime());
}

export type Performance = {
  /** Value at the start of the window (the last entry on or before it). */
  start: number;
  end: number;
  /** Net money paid in during the window. */
  contributions: number;
  /** Change in value that did not come from paying money in. */
  gain: number;
  /** Modified Dietz return: gain over start plus time-weighted contributions. Null when undefined. */
  returnPct: number | null;
};

/**
 * Performance of one account between `from` and `to` (inclusive).
 *
 * The opening balance is the last entry on or before `from`. If the account only
 * began later, its first entry is the opening balance and its own contribution is
 * ignored, since that entry is the money it started with.
 * Modified Dietz weights each contribution by the share of the window it was invested for.
 */
export function accountPerformance(entries: Entry[], from: string, to: string): Performance | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const upTo = sorted.filter((e) => e.date <= to);
  if (upTo.length === 0) return null;

  let open = [...upTo].reverse().find((e) => e.date <= from);
  if (!open) open = upTo[0];
  const end = upTo[upTo.length - 1];
  const flows = upTo.filter((e) => e.date > open.date);

  const t0 = ms(open.date);
  const span = ms(end.date) - t0;
  const contributions = flows.reduce((s, e) => s + e.contribution, 0);
  const gain = end.value - open.value - contributions;
  const weighted = flows.reduce(
    (s, e) => s + e.contribution * (span > 0 ? (ms(end.date) - ms(e.date)) / span : 0),
    0,
  );
  const base = open.value + weighted;
  return {
    start: open.value,
    end: end.value,
    contributions,
    gain,
    returnPct: base > 0 && span > 0 ? gain / base : null,
  };
}

export type Point = {
  date: string;
  /** Total worth across accounts, each carried forward from its latest entry. */
  value: number;
  /** What the holdings cost: an investment's cost basis, or a balance's own amount. */
  cost: number;
};

/**
 * Total worth on every date something was recorded, within the window. An account counts at its latest
 * record on or before each date, so an investment is valued at the units held times the last price known.
 */
export function netWorthSeries(byAccount: Entry[][], from: string | null, to: string): Point[] {
  const dates = new Set<string>();
  for (const list of byAccount) for (const e of list) if (e.date <= to && (!from || e.date >= from)) dates.add(e.date);
  // Something recorded before the window still holds inside it: the window opens on what was last known.
  if (from && from <= to && byAccount.some((l) => l.some((e) => e.date < from))) dates.add(from);

  const sorted = byAccount.map((l) => [...l].sort((a, b) => a.date.localeCompare(b.date)));
  return [...dates].sort().map((date) => {
    let value = 0;
    let cost = 0;
    for (const list of sorted) {
      const seen = list.filter((e) => e.date <= date);
      const last = seen[seen.length - 1];
      if (!last) continue;
      value += last.value;
      cost += last.cost ?? last.value;
    }
    return { date, value, cost };
  });
}

export type Unit = "day" | "month" | "year";

/** Runs the series on to `today` at the latest values: nothing recorded since means nothing is known to have changed. */
export function extendTo(points: Point[], today: string): Point[] {
  const last = points[points.length - 1];
  return last && last.date < today ? [...points, { ...last, date: today }] : points;
}

/**
 * The series at one step, run on to `today`. Values carry forward: until a new record, the worth stays what
 * it last was (units held at the last price entered). "day" fills every calendar day so the line is evenly
 * spaced; "month" and "year" keep the last point of each.
 */
export function resample(points: Point[], unit: Unit, today: string): Point[] {
  if (points.length === 0) return [];
  const run = extendTo(points, today);

  if (unit !== "day") {
    const len = unit === "month" ? 7 : 4;
    const byKey = new Map<string, Point>();
    for (const p of run) byKey.set(p.date.slice(0, len), p); // later points overwrite earlier ones
    return [...byKey.values()];
  }

  const out: Point[] = [];
  let i = 0;
  for (let t = ms(run[0].date); t <= ms(run[run.length - 1].date); t += DAY) {
    const date = iso(t);
    while (i + 1 < run.length && run[i + 1].date <= date) i++;
    out.push({ date, value: run[i].value, cost: run[i].cost });
  }
  return out;
}

export function totalPerformance(byAccount: Entry[][], from: string, to: string): Performance {
  const parts = byAccount.map((l) => accountPerformance(l, from, to)).filter((p): p is Performance => p !== null);
  const sum = (f: (p: Performance) => number) => parts.reduce((s, p) => s + f(p), 0);
  const start = sum((p) => p.start);
  const end = sum((p) => p.end);
  const contributions = sum((p) => p.contributions);
  const gain = sum((p) => p.gain);
  // Weight each account by its own capital base so the total return is the capital-weighted one.
  const bases = parts.map((p) => (p.returnPct && p.returnPct !== -1 ? p.gain / p.returnPct : p.start));
  const base = bases.reduce((s, b) => s + b, 0);
  return { start, end, contributions, gain, returnPct: base > 0 ? gain / base : null };
}

export const daysBetween = (a: string, b: string) => Math.round((ms(b) - ms(a)) / DAY);
