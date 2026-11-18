import { totals as billTotals } from "./bills.ts";
import { monthsBetween, shiftMonth } from "./spending.ts";
import type { Bill, MonthlyIncome, MonthlySpending, Spending } from "./types.ts";

export type MonthSaved = {
  month: string;
  income: number;
  /** Everyday spending, hobbies bought that month, and the bills at their monthly cost. */
  spent: number;
  saved: number;
  /** Saved as a share of income; null when nothing came in. */
  rate: number | null;
};

/**
 * What was kept of what came in during `month`: income less everyday spending, hobbies bought that month and the
 * bills still running (at their monthly cost, so a yearly bill counts a twelfth each month). Null when no income
 * is recorded for the month: without it there is nothing to compare the spending with.
 */
export function savedIn(
  month: string, income: MonthlyIncome[], everyday: MonthlySpending[], hobbies: Pick<Spending, "date" | "amount">[], bills: Bill[],
): MonthSaved | null {
  const got = income.find((i) => i.month === month);
  if (!got) return null;
  const day = everyday.filter((r) => r.month === month).reduce((s, r) => s + r.amount, 0);
  const fun = hobbies.filter((h) => h.date.slice(0, 7) === month).reduce((s, h) => s + h.amount, 0);
  // Bills as they stood at the end of that month.
  const end = `${shiftMonth(month, 1)}-01`;
  const live = bills.filter((b) => b.firstDue < end);
  const billed = billTotals(live, `${month}-01`).now;
  const spent = day + fun + billed;
  return { month, income: got.amount, spent, saved: got.amount - spent, rate: got.amount > 0 ? (got.amount - spent) / got.amount : null };
}

/**
 * The savings rate over the last `months` whole months that have income recorded (this month is still going):
 * everything saved over everything that came in, so a big month weighs more than a small one.
 */
export function savingsRate(
  today: string, income: MonthlyIncome[], everyday: MonthlySpending[], hobbies: Pick<Spending, "date" | "amount">[], bills: Bill[], months = 6,
) {
  const month = today.slice(0, 7);
  const list = monthsBetween(shiftMonth(month, -months), shiftMonth(month, -1))
    .map((m) => savedIn(m, income, everyday, hobbies, bills))
    .filter((x): x is MonthSaved => x !== null);
  const inc = list.reduce((s, m) => s + m.income, 0);
  const saved = list.reduce((s, m) => s + m.saved, 0);
  return { months: list, income: inc, saved, rate: inc > 0 ? saved / inc : null, perMonth: list.length > 0 ? saved / list.length : null };
}
