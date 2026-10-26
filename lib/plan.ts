import type { PlanItem } from "./types";

export type Payment = { date: string; amount: number; itemId: number; name: string };

const pad = (n: number) => String(n).padStart(2, "0");
const parse = (s: string) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) - 1, d: +s.slice(8, 10) });

/** Adds months, keeping the day of the month but never spilling into the next one (31 Jan + 1 month is 28 Feb). */
export function addMonths(date: string, n: number): string {
  const { y, m, d } = parse(date);
  const last = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m + n, Math.min(d, last)));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Every payment the items add up to, oldest first. */
export function payments(items: PlanItem[]): Payment[] {
  const out: Payment[] = [];
  for (const it of items) {
    const count = it.frequency === "once" ? 1 : it.occurrences;
    const step = it.frequency === "yearly" ? 12 : 1;
    // Each date counts from the first, not from the one before, so a day clamped to the 28th comes back to the 31st.
    for (let k = 0; k < count; k++) out.push({ date: addMonths(it.startDate, k * step), amount: it.amount, itemId: it.id, name: it.name });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.itemId - b.itemId);
}

export type MonthRow = {
  /** yyyy-mm */
  month: string;
  payments: Payment[];
  spend: number;
  /** Spending so far, this month included. */
  cumulative: number;
  /** Money available by this month: today's funds plus what was set aside since. */
  funds: number;
  /** Funds minus cumulative spending. Below zero means the plan can't be paid by then. */
  balance: number;
};

export type Schedule = {
  /** Payments dated before today: already out of your assets, so they are not asked of them again. */
  past: Payment[];
  rows: MonthRow[];
  /** Everything the plan costs, past and to come. */
  total: number;
  /** What is still to pay from today. */
  remaining: number;
  /** First month the funds fall short, if any. */
  shortFrom: string | null;
  /** The worst balance reached, and its month. */
  low: { month: string; balance: number } | null;
};

/** The month-by-month picture, from the current month to the last payment. */
export function schedule(all: Payment[], funds: number, monthlySaving: number, today: string): Schedule {
  const past = all.filter((p) => p.date < today);
  const coming = all.filter((p) => p.date >= today);
  const total = all.reduce((s, p) => s + p.amount, 0);
  const remaining = coming.reduce((s, p) => s + p.amount, 0);
  if (coming.length === 0) return { past, rows: [], total, remaining, shortFrom: null, low: null };

  const first = today.slice(0, 7);
  const last = coming[coming.length - 1].date.slice(0, 7);
  const rows: MonthRow[] = [];
  let cumulative = 0;
  for (let month = first, i = 0; month <= last; month = addMonths(`${month}-01`, 1).slice(0, 7), i++) {
    const here = coming.filter((p) => p.date.startsWith(month));
    const spend = here.reduce((s, p) => s + p.amount, 0);
    cumulative += spend;
    const available = funds + monthlySaving * i;
    rows.push({ month, payments: here, spend, cumulative, funds: available, balance: available - cumulative });
  }
  const short = rows.find((r) => r.balance < 0);
  const worst = rows.reduce((w, r) => (r.balance < w.balance ? r : w), rows[0]);
  return { past, rows, total, remaining, shortFrom: short?.month ?? null, low: { month: worst.month, balance: worst.balance } };
}
