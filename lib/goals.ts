import { addMonths } from "./plan.ts";
import type { Entry, GoalVersion } from "./types.ts";

type Plan = Pick<GoalVersion, "startDate" | "startValue" | "targetDate" | "targetMode" | "targetAmount" | "monthlySpending"
  | "withdrawalRate" | "expectedReturn" | "inflation" | "monthlyContribution" | "contributionGrowth">;

/** Calendar months from a's month to b's (days ignored). */
export const monthsBetween = (a: string, b: string) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
const years = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / (365.25 * 86_400_000);
/** The monthly rate that compounds to `yearly` over twelve months. */
const monthlyRate = (yearly: number) => Math.pow(1 + yearly, 1 / 12) - 1;

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

/** The planned contribution in month k (1 = the first month after the start): it rises each full year by the growth. */
export const contributionAt = (p: Plan, k: number) => p.monthlyContribution * Math.pow(1 + p.contributionGrowth, Math.floor((k - 1) / 12));

export type PathPoint = { k: number; date: string; value: number; contributed: number };

/**
 * Month-by-month values from month `fromK` (worth `value` then) to the target, growing at the expected return with
 * the planned contribution added each month. From k = 0 and the start value this is the plan itself; from today's
 * month and today's actual value it is the projection of carrying on as planned.
 */
export function path(p: Plan, fromK = 0, value = p.startValue, untilK = monthsBetween(p.startDate, p.targetDate)): PathPoint[] {
  const r = monthlyRate(p.expectedReturn);
  const out: PathPoint[] = [{ k: fromK, date: addMonths(p.startDate, fromK), value, contributed: 0 }];
  let v = value;
  let paid = 0;
  for (let k = fromK + 1; k <= untilK; k++) {
    const c = contributionAt(p, k);
    v = v * (1 + r) + c;
    paid += c;
    out.push({ k, date: addMonths(p.startDate, k), value: v, contributed: paid });
  }
  return out;
}

/**
 * The monthly contribution (at the plan's first-year level, rising as planned) that takes `value` in month `fromK`
 * to the target by the target date. The end value is linear in it, so it comes straight out.
 */
export function requiredMonthly(p: Plan, fromK: number, value: number): number | null {
  const n = monthsBetween(p.startDate, p.targetDate);
  if (fromK >= n) return null;
  const none = path({ ...p, monthlyContribution: 0 }, fromK, value).at(-1)!.value;
  const one = path({ ...p, monthlyContribution: 1 }, fromK, value).at(-1)!.value - none;
  return one > 0 ? Math.max(0, (targetValue(p) - none) / one) : null;
}

/** The first month, carrying on as planned from `value` in month `fromK`, that reaches the target (up to 50 years on). */
export function reachDate(p: Plan, fromK: number, value: number): string | null {
  const target = targetValue(p);
  if (value >= target) return addMonths(p.startDate, fromK);
  const hit = path(p, fromK, value, fromK + 600).find((pt) => pt.value >= target);
  return hit?.date ?? null;
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
  const pt = path(p, 0, p.startValue, k).at(-1)!;
  const actual = valueOn(lists, today);
  const actualPaid = paidIn(lists, p.startDate, today);
  const gap = actual - pt.value;
  const fromContributions = actualPaid - pt.contributed;
  return { k, planned: pt.value, actual, gap, fromContributions, fromReturns: gap - fromContributions, plannedPaid: pt.contributed, actualPaid };
}

export type YearRow = { year: number; plannedPaid: number; actualPaid: number | null; plannedEnd: number; actualEnd: number | null };

/** Year by year from the start to the target: planned and actual money put in and value at the year's end (or today). */
export function yearly(p: Plan, lists: Entry[][], today: string): YearRow[] {
  const plan = path(p);
  const rows: YearRow[] = [];
  for (let y = +p.startDate.slice(0, 4); y <= +p.targetDate.slice(0, 4); y++) {
    const inYear = plan.filter((pt) => +pt.date.slice(0, 4) === y);
    const before = plan.filter((pt) => +pt.date.slice(0, 4) < y).at(-1);
    const last = inYear.at(-1) ?? before ?? plan[0];
    const plannedPaid = last.contributed - (before?.contributed ?? 0);
    const yearStart = `${y - 1}-12-31` < p.startDate ? p.startDate : `${y - 1}-12-31`;
    const yearEnd = `${y}-12-31` < today ? `${y}-12-31` : today;
    const past = yearStart < today;
    rows.push({
      year: y,
      plannedPaid,
      actualPaid: past ? paidIn(lists, yearStart, yearEnd) : null,
      plannedEnd: last.value,
      actualEnd: past ? valueOn(lists, yearEnd) : null,
    });
  }
  return rows;
}
