import { addMonths, type Payment } from "./plan.ts";
import type { Point } from "./performance.ts";

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
  /** The trend less plan payments due by this date; null in the past. */
  afterPlans: number | null;
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
  /** Value at the end of the forecast, on the trend and after plan payments. */
  end: { date: string; trend: number; afterPlans: number };
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
 * off it as they fall. This is a forecast only: nothing is taken out of any asset.
 *
 * `series` is the total value over time, ending today. The history shown is the last `months` months too, one
 * point at the end of each month, then today.
 */
export function forecast(series: Point[], today: string, planPayments: Payment[], months = 6, lookback = 12): Forecast {
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

  const points: ForecastPoint[] = [];
  // History: the end of each of the last months, from the first record on.
  for (let k = months; k >= 1; k--) {
    const monthEnd = addMonths(`${today.slice(0, 7)}-01`, -k + 1);
    const date = new Date(ms(monthEnd) - DAY).toISOString().slice(0, 10);
    if (date >= first && date < today) points.push({ date, actual: valueOn(series, date), trend: null, afterPlans: null });
  }
  // Today joins the lines; payments due today have not left the recorded value yet.
  points.push({ date: today, actual: now, trend: now, afterPlans: now - dueBy(today) });
  for (let k = 1; k <= months; k++) {
    const date = addMonths(today, k);
    const trend = now + monthly * k;
    points.push({ date, actual: null, trend, afterPlans: trend - dueBy(date) });
  }

  const last = points[points.length - 1];
  return { points, today: now, monthly, basisMonths: Math.min(basisMonths, lookback), payments, end: { date: last.date, trend: last.trend!, afterPlans: last.afterPlans! } };
}
