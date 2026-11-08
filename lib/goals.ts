import { addMonths } from "./plan.ts";
import type { Entry, GoalVersion } from "./types.ts";

/** One asset in a plan: what it starts with, the yearly rate it is expected to grow at, and what goes in each month. */
export type PlanAsset = { accountId: number; startValue: number; rate: number; monthly: number };

export type Plan = Pick<GoalVersion, "startDate" | "startValue" | "targetDate" | "targetMode" | "targetAmount" | "monthlySpending"
  | "withdrawalRate" | "expectedReturn" | "inflation" | "monthlyContribution" | "contributionGrowth"> & { assets?: PlanAsset[] };

/** Calendar months from a's month to b's (days ignored). */
export const monthsBetween = (a: string, b: string) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
const years = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / (365.25 * 86_400_000);
/** The monthly rate that compounds to `yearly` over twelve months. */
const monthlyRate = (yearly: number) => Math.pow(1 + yearly, 1 / 12) - 1;

/** The plan's assets, or (for a plan made without them) one pot at the plan's own rate and monthly amount. */
export function buckets(p: Plan): PlanAsset[] {
  return p.assets && p.assets.length > 0 ? p.assets : [{ accountId: 0, startValue: p.startValue, rate: p.expectedReturn, monthly: p.monthlyContribution }];
}

/**
 * Starting values per asset: a map by account (missing ones start at 0), or one amount shared out like the plan's
 * own start values (all in the first if those are all zero), or the plan's start values.
 */
function startsOf(p: Plan, start?: number | Map<number, number>): number[] {
  const bs = buckets(p);
  if (start === undefined) return bs.map((b) => b.startValue);
  if (start instanceof Map) return bs.map((b) => start.get(b.accountId) ?? 0);
  const total = bs.reduce((s, b) => s + b.startValue, 0);
  return total > 0 ? bs.map((b) => (start * b.startValue) / total) : bs.map((_, i) => (i === 0 ? start : 0));
}

/**
 * What the goal needs on its target date. Amount mode: the amount entered. Spending mode: a year of the monthly
 * spending, grown by inflation from the start date to the target date, divided by the withdrawal rate (at 4%, a fund
 * of 25 years' spending).
 */
export function targetValue(p: Plan): number {
  if (p.targetMode === "amount") return p.targetAmount ?? 0;
  const yearly = (p.monthlySpending ?? 0) * 12 * Math.pow(1 + p.inflation, years(p.startDate, p.targetDate));
  return p.withdrawalRate > 0 ? yearly / p.withdrawalRate : 0;
}

/** How much the monthly amounts have risen by month k (1 = the first month after the start): once each full year. */
const growthAt = (p: Plan, k: number) => Math.pow(1 + p.contributionGrowth, Math.floor((k - 1) / 12));

/** The planned contribution in month k, all assets together. */
export const contributionAt = (p: Plan, k: number) => buckets(p).reduce((s, b) => s + b.monthly, 0) * growthAt(p, k);

export type PathPoint = { k: number; date: string; value: number; contributed: number };

/**
 * Month-by-month values from month `fromK` to `untilK` (the target by default): each asset grows at its own rate and
 * gets its monthly amount, and the points add them up. From k = 0 and the start values this is the plan itself; from
 * today's month and today's actual values it is the projection of carrying on as planned.
 */
export function path(p: Plan, fromK = 0, start?: number | Map<number, number>, untilK = monthsBetween(p.startDate, p.targetDate)): PathPoint[] {
  const bs = buckets(p);
  const rates = bs.map((b) => monthlyRate(b.rate));
  const v = startsOf(p, start);
  const out: PathPoint[] = [{ k: fromK, date: addMonths(p.startDate, fromK), value: v.reduce((s, x) => s + x, 0), contributed: 0 }];
  let paid = 0;
  for (let k = fromK + 1; k <= untilK; k++) {
    const g = growthAt(p, k);
    for (let i = 0; i < bs.length; i++) {
      v[i] = v[i] * (1 + rates[i]) + bs[i].monthly * g;
      paid += bs[i].monthly * g;
    }
    out.push({ k, date: addMonths(p.startDate, k), value: v.reduce((s, x) => s + x, 0), contributed: paid });
  }
  return out;
}

/**
 * The total monthly amount (at the first-year level, rising as planned) that lands on the target by the target date,
 * starting from `start` in month `fromK`. It is shared out like the planned amounts (or, with none planned, like the
 * starting values), so each part grows at its own asset's rate. The end value is linear in it, so it comes straight out.
 */
export function requiredMonthly(p: Plan, fromK: number, start?: number | Map<number, number>): number | null {
  const n = monthsBetween(p.startDate, p.targetDate);
  if (fromK >= n) return null;
  const bs = buckets(p);
  const plannedTotal = bs.reduce((s, b) => s + b.monthly, 0);
  const starts = startsOf(p, start);
  const startTotal = starts.reduce((s, x) => s + x, 0);
  const shares = bs.map((b, i) => (plannedTotal > 0 ? b.monthly / plannedTotal : startTotal > 0 ? starts[i] / startTotal : 1 / bs.length));
  const withMonthly = (m: number): Plan => ({ ...p, assets: bs.map((b, i) => ({ ...b, monthly: m * shares[i] })) });
  const startMap = new Map(bs.map((b, i) => [b.accountId, starts[i]]));
  const none = path(withMonthly(0), fromK, startMap).at(-1)!.value;
  const one = path(withMonthly(1), fromK, startMap).at(-1)!.value - none;
  return one > 0 ? Math.max(0, (targetValue(p) - none) / one) : null;
}

/** How far past the target date the retirement chart runs, as an age. */
export const LIFE_END_AGE = 95;

/**
 * What happens to the money after the target date, for a goal planned by monthly spending: the pot keeps growing at the
 * assets' rate (weighted by their start values) and each month the planned spending, grown by inflation from the plan's
 * start, comes out. Runs month by month from `endValue` on the target date until `untilDate`, stopping at 0 if it runs out.
 */
export function retirementPath(p: Plan, endValue: number, untilDate: string): { date: string; value: number }[] {
  const spending = p.monthlySpending ?? 0;
  const rate = p.assets && p.assets.length > 0 ? combined(p.assets).rate : p.expectedReturn;
  const mr = monthlyRate(rate);
  const out = [{ date: p.targetDate, value: endValue }];
  let v = endValue;
  for (let i = 1; i <= monthsBetween(p.targetDate, untilDate) && v > 0; i++) {
    const date = addMonths(p.targetDate, i);
    v = Math.max(0, v * (1 + mr) - spending * Math.pow(1 + p.inflation, years(p.startDate, date)));
    out.push({ date, value: v });
  }
  return out;
}

/** The first month, carrying on as planned from `start` in month `fromK`, that reaches the target (up to 50 years on). */
export function reachDate(p: Plan, fromK: number, start?: number | Map<number, number>): string | null {
  const target = targetValue(p);
  const pts = path(p, fromK, start, fromK + 600);
  return pts.find((pt) => pt.value >= target)?.date ?? null;
}

/** Combined figures for a set of plan assets: their total start value and monthly amount, and the rate weighted by value. */
export function combined(assets: PlanAsset[]) {
  const startValue = assets.reduce((s, a) => s + a.startValue, 0);
  const monthly = assets.reduce((s, a) => s + a.monthly, 0);
  const rate = startValue > 0
    ? assets.reduce((s, a) => s + a.rate * a.startValue, 0) / startValue
    : assets.length > 0 ? assets.reduce((s, a) => s + a.rate, 0) / assets.length : 0;
  return { startValue, monthly, rate };
}

/** Today's value of each of the goal's assets, by account. */
export function valuesOn(lists: Entry[][], date: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const list of lists) {
    if (list.length === 0) continue;
    let v = 0;
    for (const e of list) if (e.date <= date) v = e.value;
    out.set(list[0].accountId, v);
  }
  return out;
}

/** The value of the goal's assets on `date`: each at its last record on or before it. */
export function valueOn(lists: Entry[][], date: string): number {
  let total = 0;
  for (const list of lists) {
    let v = 0;
    for (const e of list) if (e.date <= date) v = e.value;
    total += v;
  }
  return total;
}

/** Money put into the goal's assets after `from` up to `to` (buys and deposits less sales and withdrawals). */
export function paidIn(lists: Entry[][], from: string, to: string): number {
  return lists.flat().filter((e) => e.date > from && e.date <= to).reduce((s, e) => s + e.contribution, 0);
}

export type Standing = {
  /** Month index of today in the plan. */
  k: number;
  planned: number;
  actual: number;
  gap: number;
  /** Part of the gap from putting in more or less than planned. */
  fromContributions: number;
  /** The rest: returns better or worse than assumed. */
  fromReturns: number;
  plannedPaid: number;
  actualPaid: number;
};

/** Where the goal stands on `today` against the plan: the gap, and how much of it is from contributions or returns. */
export function standing(p: Plan, lists: Entry[][], today: string): Standing {
  const n = monthsBetween(p.startDate, p.targetDate);
  const k = Math.max(0, Math.min(n, monthsBetween(p.startDate, today)));
  const pt = path(p, 0, undefined, k).at(-1)!;
  const actual = valueOn(lists, today);
  const actualPaid = paidIn(lists, p.startDate, today);
  const gap = actual - pt.value;
  const fromContributions = actualPaid - pt.contributed;
  return { k, planned: pt.value, actual, gap, fromContributions, fromReturns: gap - fromContributions, plannedPaid: pt.contributed, actualPaid };
}

export type YearRow = {
  year: number;
  /** The current year is compared to date: plan and actual both stop at today. Later years are the plan alone. */
  toDate: boolean;
  plannedPaid: number;
  actualPaid: number | null;
  plannedEnd: number;
  actualEnd: number | null;
  /** Growth in the year from returns: the value gained less the money put in. */
  plannedGrowth: number;
  actualGrowth: number | null;
};

/** Year by year from the start to the target: money put in, value at the year's end and the growth, planned and actual. */
export function yearly(p: Plan, lists: Entry[][], today: string): YearRow[] {
  const plan = path(p);
  const n = plan.length - 1;
  const at = (date: string) => plan[Math.max(0, Math.min(n, monthsBetween(p.startDate, date)))];
  const rows: YearRow[] = [];
  for (let y = +p.startDate.slice(0, 4); y <= +p.targetDate.slice(0, 4); y++) {
    const yearStart = `${y - 1}-12-31` < p.startDate ? p.startDate : `${y - 1}-12-31`;
    const fullEnd = `${y}-12-31`;
    const past = yearStart <= today;
    const yearEnd = past && fullEnd > today ? today : fullEnd;
    const from = at(yearStart);
    const to = at(yearEnd);
    const plannedPaid = to.contributed - from.contributed;
    const actualPaid = past ? paidIn(lists, yearStart, yearEnd) : null;
    const actualEnd = past ? valueOn(lists, yearEnd) : null;
    rows.push({
      year: y,
      toDate: past && yearEnd === today,
      plannedPaid,
      actualPaid,
      plannedEnd: to.value,
      actualEnd,
      plannedGrowth: to.value - from.value - plannedPaid,
      actualGrowth: actualEnd === null ? null : actualEnd - valueOn(lists, yearStart) - (actualPaid ?? 0),
    });
  }
  return rows;
}
