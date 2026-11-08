import { addMonths } from "./plan.ts";
import type { Bill } from "./types.ts";

export const EVERY = [
  { id: 1, label: "Every month", short: "Monthly" },
  { id: 3, label: "Every 3 months", short: "Quarterly" },
  { id: 6, label: "Every 6 months", short: "Half-yearly" },
  { id: 12, label: "Every year", short: "Yearly" },
] as const;

/** Groups offered when adding a bill; any other name can be typed. */
export const BILL_GROUPS = ["Home", "Utilities", "Phone & internet", "Subscriptions", "Insurance", "Transport", "Loans", "Other"];

/** A bill's cost spread evenly over the months, so a yearly 1,200 counts as 100 a month. */
export const perMonth = (amount: number, everyMonths: number) => amount / everyMonths;

/** True if the bill has ended before `today` (its last payment is behind it). */
export const ended = (b: Pick<Bill, "endDate">, today: string) => b.endDate !== null && b.endDate < today;

/** The next payment on or after `today`, or null once the bill has ended. Each date counts from the first, so a day clamped to the 28th comes back to the 31st. */
export function nextDue(b: Pick<Bill, "firstDue" | "everyMonths" | "endDate">, today: string): string | null {
  let k = 0;
  let date = b.firstDue;
  while (date < today) date = addMonths(b.firstDue, ++k * b.everyMonths);
  return b.endDate !== null && date > b.endDate ? null : date;
}

/** What a bill costs a month now, and with the plan applied (dropped, or at the planned amount). */
export function monthly(b: Pick<Bill, "amount" | "everyMonths" | "planAmount" | "planDrop">) {
  const now = perMonth(b.amount, b.everyMonths);
  const planned = b.planDrop ? 0 : perMonth(b.planAmount ?? b.amount, b.everyMonths);
  return { now, planned };
}

/** Totals of the bills still running: per month and per year, now and with the plan. */
export function totals(bills: Bill[], today: string) {
  const live = bills.filter((b) => !ended(b, today));
  const now = live.reduce((s, b) => s + monthly(b).now, 0);
  const planned = live.reduce((s, b) => s + monthly(b).planned, 0);
  return { now, planned, saving: now - planned, count: live.length };
}

/** Payments due from `today` to `days` days ahead, soonest first. */
export function dueWithin(bills: Bill[], today: string, days: number): { bill: Bill; date: string }[] {
  const until = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return bills
    .map((bill) => ({ bill, date: nextDue(bill, today) }))
    .filter((x): x is { bill: Bill; date: string } => x.date !== null && x.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));
}
