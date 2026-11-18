import { totals as billTotals } from "./bills.ts";
import { monthsBetween, shiftMonth } from "./spending.ts";
import type { Bill, MonthlySpending, Tier } from "./types.ts";

/** Assets that can be turned into cash within days count toward the runway. */
export const LIQUID = ["immediate", "days"] as const;

export type Runway = {
  /** What the liquid assets are worth today. */
  liquid: number;
  /** A month of Must and Need spending (categories not sorted yet counted with them), plus the bills still running. */
  essentials: number;
  /** A month of all everyday spending, plus the bills. */
  usual: number;
  /** How many months the liquid assets last at each; null when there is nothing to divide by. */
  essentialMonths: number | null;
  usualMonths: number | null;
  /** The months the spending average was taken over (whole months with something recorded). */
  basisMonths: number;
};

/**
 * How long the money you can reach quickly would last if nothing came in. Spending is the average of the last 6
 * whole months with anything recorded (this month is still being filled in, and an empty month is one not filled in
 * yet, not one of spending nothing). Bills are counted at their monthly cost, as a Must.
 */
export function runway(
  assets: { liquidity: string; value: number }[],
  categories: { id: number; tier: Tier | null }[],
  spending: MonthlySpending[],
  bills: Bill[],
  today: string,
): Runway {
  const liquid = assets.filter((a) => (LIQUID as readonly string[]).includes(a.liquidity)).reduce((s, a) => s + a.value, 0);
  const month = today.slice(0, 7);
  const recorded = new Set(spending.map((r) => r.month));
  const window = monthsBetween(shiftMonth(month, -6), shiftMonth(month, -1)).filter((m) => recorded.has(m));
  const tierOf = new Map(categories.map((c) => [c.id, c.tier]));
  const inWindow = spending.filter((r) => window.includes(r.month));
  const avg = (rows: MonthlySpending[]) => (window.length > 0 ? rows.reduce((s, r) => s + r.amount, 0) / window.length : 0);
  const billsMonthly = billTotals(bills, today).now;
  const essentials = avg(inWindow.filter((r) => tierOf.get(r.categoryId) !== "want")) + billsMonthly;
  const usual = avg(inWindow) + billsMonthly;
  const months = (out: number) => (out > 0 ? liquid / out : null);
  return { liquid, essentials, usual, essentialMonths: months(essentials), usualMonths: months(usual), basisMonths: window.length };
}
