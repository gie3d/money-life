import { addMonths, type Payment } from "./plan.ts";
import { accountPerformance, type Point } from "./performance.ts";
import type { Entry } from "./types.ts";

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Average days in a month, for turning a span of days into months. */
const MONTH_DAYS = 365.25 / 12;

export type ForecastPoint = {
  date: string;
  /** Recorded total value; null in the future. */
  actual: number | null;
  /** Today's value carried on at the recent average monthly change; null in the past. */
  trend: number | null;
  /** The trend less plan costs and plus plan income due by this date; null in the past. */
  afterPlans: number | null;
  /** A likely range around the after-plans line, from how much investments have swung month to month; null in the past or without enough history. */
  low: number | null;
  high: number | null;
};

export type Forecast = {
  points: ForecastPoint[];
  today: number;
  /** Average change in total value per month over the lookback (deposits and withdrawals included). */
  monthly: number;
  /** How many months that average is taken over: the lookback, or less for a newer tracker. */
  basisMonths: number;
  /** Plan payments falling from today to the end of the forecast, oldest first. */
  payments: Payment[];
  /** Plan income falling from today to the end of the forecast, oldest first. */
  income: Payment[];
  /** How the trend was split: money saved a month and investment growth, when a model was given. */
  model: Model | null;
  /** Value at the end of the forecast, on the trend and after plan payments. */
  end: { date: string; trend: number; afterPlans: number; low: number | null; high: number | null };
};

/** The value on `date`: the last point on or before it, or 0 before the first. */
function valueOn(series: Point[], date: string): number {
  let v = 0;
  for (const p of series) if (p.date <= date) v = p.value;
  return v;
}

/**
 * Where the total value is heading over the next `months` months. The trend continues the average monthly
 * change of the last `lookback` months (or since the first record, if that is more recent); under a month
 * of history there is no trend to go on, so it stays flat. Plan payments due from today on are then taken
 * off it as they fall, and plan income due from today on is added. This is a forecast only: nothing is taken out of any asset.
 *
 * `series` is the total value over time, ending today. The history shown is the last `months` months too, one
 * point at the end of each month, then today.
 */
export function forecast(series: Point[], today: string, planPayments: Payment[], months = 6, lookback = 12, planIncome: Payment[] = [], model: Model | null = null): Forecast {
  const now = valueOn(series, today);
  const first = series[0]?.date ?? today;
  const back = addMonths(today, -lookback);
  const from = back > first ? back : first;
  // A full lookback is exactly that many months; a shorter history is counted in average-length months.
  const basisMonths = from === back ? lookback : (ms(today) - ms(from)) / DAY / MONTH_DAYS;
  const monthly = basisMonths >= 1 ? (now - valueOn(series, from)) / basisMonths : 0;

  const horizon = addMonths(today, months);
  const payments = planPayments.filter((p) => p.date >= today && p.date <= horizon).sort((a, b) => a.date.localeCompare(b.date));
  const dueBy = (date: string) => payments.filter((p) => p.date <= date).reduce((s, p) => s + p.amount, 0);
  const income = planIncome.filter((p) => p.date >= today && p.date <= horizon).sort((a, b) => a.date.localeCompare(b.date));
  const incomeBy = (date: string) => income.filter((p) => p.date <= date).reduce((s, p) => s + p.amount, 0);

  const points: ForecastPoint[] = [];
  // History: the end of each of the last months, from the first record on.
  for (let k = months; k >= 1; k--) {
    const monthEnd = addMonths(`${today.slice(0, 7)}-01`, -k + 1);
    const date = new Date(ms(monthEnd) - DAY).toISOString().slice(0, 10);
    if (date >= first && date < today) points.push({ date, actual: valueOn(series, date), trend: null, afterPlans: null, low: null, high: null });
  }
  // Today joins the lines; payments due today have not left the recorded value yet.
  const todayAfter = now - dueBy(today) + incomeBy(today);
  const band = model?.volatility != null;
  points.push({ date: today, actual: now, trend: now, afterPlans: todayAfter, low: band ? todayAfter : null, high: band ? todayAfter : null });
  for (let k = 1; k <= months; k++) {
    const date = addMonths(today, k);
    const trend = model ? projectAll(model, k) : now + monthly * k;
    const afterPlans = trend - dueBy(date) + incomeBy(date);
    const spread = model && band ? spreadAt(model, k) : null;
    points.push({ date, actual: null, trend, afterPlans, low: spread && afterPlans - spread.down, high: spread && afterPlans + spread.up });
  }

  const last = points[points.length - 1];
  return { points, today: now, monthly, basisMonths: Math.min(basisMonths, lookback), payments, income, model, end: { date: last.date, trend: last.trend!, afterPlans: last.afterPlans!, low: last.low, high: last.high } };
}

/**
 * The trend split in two: money you put in (saved) and what your investments earned on their own (growth).
 * Carrying the two on separately keeps a one-off deposit from reading as growth, and lets growth compound.
 */
export type Model = {
  /** What the assets are worth today: investments (which grow) and everything else (which doesn't). */
  invested: number;
  other: number;
  /** Average money put in a month over the lookback, withdrawals taken off: the change in value less investment gain. */
  saved: number;
  /** Investment growth a month, compounding: the lookback's money-weighted return spread evenly over its months. */
  rate: number;
  /** Months the averages are taken over (under one: no trend at all). */
  basisMonths: number;
  /** How much the investments' monthly return has varied (its standard deviation); null with under 3 months to go on. */
  volatility?: number | null;
};

export type ModelAsset = { entries: Entry[]; investment: boolean };

/** The model for a set of assets, over the last `lookback` months (or since the first record, if more recent). */
export function model(assets: ModelAsset[], today: string, lookback = 12): Model {
  const all = assets.flatMap((a) => a.entries);
  const first = all.reduce((m, e) => (e.date < m ? e.date : m), today);
  const back = addMonths(today, -lookback);
  const from = back > first ? back : first;
  const basisMonths = from === back ? lookback : (ms(today) - ms(from)) / DAY / MONTH_DAYS;
  const last = (entries: Entry[], date: string) => {
    let v = 0;
    for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) if (e.date <= date) v = e.value;
    return v;
  };
  let invested = 0, other = 0, change = 0, gain = 0, base = 0;
  for (const a of assets) {
    const now = last(a.entries, today);
    change += now - last(a.entries, from);
    if (!a.investment) { other += now; continue; }
    invested += now;
    const p = accountPerformance(a.entries, from, today);
    if (!p) continue;
    gain += p.gain;
    // Each asset's capital base, as in totalPerformance, so the return is weighted by the money in each.
    base += p.returnPct && p.returnPct !== -1 ? p.gain / p.returnPct : p.start;
  }
  if (basisMonths < 1) return { invested, other, saved: 0, rate: 0, basisMonths };
  const ret = base > 0 ? gain / base : 0;
  return { invested, other, saved: (change - gain) / basisMonths, rate: ret > -1 ? (1 + ret) ** (1 / basisMonths) - 1 : 0, basisMonths };
}

/**
 * How far the line may land below and above the trend after `k` months: one standard deviation of the monthly
 * swings, widening with the square root of time, applied to what the investments are projected to be worth.
 * About two times in three the value should land inside it, if the coming months swing as the past ones did.
 * Money put in is taken as certain, so only investments widen the range.
 */
function spreadAt(m: Model & { parts?: Model[] }, k: number) {
  const invested = (m.parts ?? [m]).reduce((s, p) => s + p.invested * (1 + p.rate) ** k, 0);
  const w = (m.volatility ?? 0) * Math.sqrt(k);
  return { down: invested * (1 - Math.exp(-w)), up: invested * (Math.exp(w) - 1) };
}

/**
 * The standard deviation of the investments' monthly return, month by month over the lookback (each month's
 * gain over the money in it, as in the model). Null with fewer than 3 whole months to go on.
 */
export function volatility(assets: ModelAsset[], today: string, lookback = 12): number | null {
  const inv = assets.filter((a) => a.investment);
  const first = inv.flatMap((a) => a.entries).reduce((m, e) => (e.date < m ? e.date : m), today);
  const returns: number[] = [];
  for (let j = 1; j <= lookback; j++) {
    const from = addMonths(today, -j);
    if (from < first) break;
    const to = addMonths(today, -j + 1);
    let gain = 0, base = 0;
    for (const a of inv) {
      const p = accountPerformance(a.entries, from, to);
      if (!p) continue;
      gain += p.gain;
      base += p.returnPct && p.returnPct !== -1 ? p.gain / p.returnPct : p.start;
    }
    if (base > 0) returns.push(gain / base);
  }
  if (returns.length < 3) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  return Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1));
}

/** The value `k` months from today: investments compounding at the model's rate, plus what is saved by then (which isn't grown). */
export const project = (m: Model, k: number) => m.other + m.invested * (1 + m.rate) ** k + m.saved * k;

/** Several models as one: the sum of their projections. */
export function combined(models: Model[]): Model & { parts: Model[] } {
  const sum = (f: (m: Model) => number) => models.reduce((s, m) => s + f(m), 0);
  const invested = sum((m) => m.invested);
  // The rate shown for the whole is the money-weighted one; projections still sum the parts.
  return { invested, other: sum((m) => m.other), saved: sum((m) => m.saved), rate: invested > 0 ? sum((m) => m.invested * m.rate) / invested : 0, basisMonths: Math.max(0, ...models.map((m) => m.basisMonths)), parts: models };
}

/** One row per forecast point: its date, and each layer's value then (recorded up to today, on its own model after). */
export type LayerRow = { date: string } & Record<string, number | string>;

/** The forecast's dates split into layers (asset categories, say), which add up to the total trend. */
export function layered(points: ForecastPoint[], layers: { id: string; series: Point[]; model: Model }[], today: string): LayerRow[] {
  let k = 0;
  return points.map((p) => {
    const row: LayerRow = { date: p.date };
    if (p.date > today) k++;
    for (const l of layers) row[l.id] = p.date <= today ? valueOn(l.series, p.date) : project(l.model, k);
    return row;
  });
}

/** A combined model projects as the sum of its parts, so the layers and the total always agree. */
const projectAll = (m: Model & { parts?: Model[] }, k: number) => (m.parts ? m.parts.reduce((s, p) => s + project(p, k), 0) : project(m, k));
