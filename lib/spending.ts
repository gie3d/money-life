import type { MonthlySpending, Spending } from "./types.ts";

/** What a new list of everyday categories starts with, if the user wants a start; any can be removed or added. */
export const STARTER_CATEGORIES = ["Food & drinks", "Groceries", "Transport", "Shopping", "Home", "Health", "Family", "Going out", "Other"];

/** Hobbies offered when adding one; any other name can be typed. */
export const HOBBY_CATEGORIES = ["Travel", "Gadgets", "Sports", "Photography", "Games", "Music", "Books", "Collecting", "Other"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11" moved by `n` months. */
export const shiftMonth = (month: string, n: number) => {
  const t = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
};

/** The months from `from` to `to` (yyyy-mm), oldest first. */
export const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) out.push(m);
  return out;
};

export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isYear = (s: unknown): s is string => typeof s === "string" && /^\d{4}$/.test(s);

export const sum = (items: { amount: number }[]) => items.reduce((s, x) => s + x.amount, 0);

/* ---- Everyday: one amount per category per month ---- */

/** Each month's total, for every month that has any amount. */
export function monthTotals(rows: MonthlySpending[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.month, (out.get(r.month) ?? 0) + r.amount);
  return out;
}

/** The amount of one category in one month (0 when none is recorded). */
export const amountOf = (rows: MonthlySpending[], categoryId: number, month: string) =>
  rows.find((r) => r.categoryId === categoryId && r.month === month)?.amount ?? 0;

/**
 * A month compared with the one before and with the average of the 6 before it. Only months with something recorded
 * count toward the average: a month left empty is one not filled in yet, not one of spending nothing.
 */
export function compareMonth(rows: MonthlySpending[], month: string) {
  const totals = monthTotals(rows);
  const prev = shiftMonth(month, -1);
  const window = monthsBetween(shiftMonth(month, -6), prev).filter((m) => totals.has(m));
  const average = window.length > 0 ? window.reduce((s, m) => s + (totals.get(m) ?? 0), 0) / window.length : null;
  return {
    month, prev,
    total: totals.get(month) ?? 0,
    prevTotal: totals.has(prev) ? totals.get(prev)! : null,
    average, averageMonths: window.length,
  };
}

/* ---- Hobbies: each thing bought, year by year ---- */

export const yearOf = (s: Pick<Spending, "date">) => s.date.slice(0, 4);

/** Each category's total in `items`, largest first. */
export function byCategory(items: Spending[]): { category: string; total: number; count: number }[] {
  const out = new Map<string, { total: number; count: number }>();
  for (const s of items) {
    const c = out.get(s.category) ?? { total: 0, count: 0 };
    out.set(s.category, { total: c.total + s.amount, count: c.count + 1 });
  }
  return [...out].map(([category, c]) => ({ category, ...c })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

/** Every hobby used, the most spent on first: the order their colours follow, so a hobby keeps its colour from year to year. */
export const categoryOrder = (items: Spending[]) => byCategory(items).map((c) => ({ id: c.category }));

/** A year compared with the one before and, while it is running, with the same part of last year (1 Jan to today's date). */
export function compareYear(items: Spending[], year: string, today: string) {
  const prev = String(+year - 1);
  const total = sum(items.filter((s) => yearOf(s) === year));
  const prevTotal = sum(items.filter((s) => yearOf(s) === prev));
  const running = today.slice(0, 4) === year;
  // 29 Feb compares with 28 Feb in a year that has none: string order does that by itself.
  const prevSoFar = running ? sum(items.filter((s) => yearOf(s) === prev && s.date.slice(5) <= today.slice(5))) : null;
  const before = new Map<string, number>();
  for (const s of items) if (yearOf(s) < year) before.set(yearOf(s), (before.get(yearOf(s)) ?? 0) + s.amount);
  const average = before.size > 0 ? [...before.values()].reduce((a, b) => a + b, 0) / before.size : null;
  return { year, prev, total, prevTotal, running, prevSoFar, average, averageYears: before.size };
}

/** The change from `before` to `now` as a share of `before`, or null when there is nothing to compare with. */
export const change = (now: number, before: number | null) => (before === null || before <= 0 ? null : (now - before) / before);
