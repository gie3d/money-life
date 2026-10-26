import { investmentEntries, latestPrice, replay } from "./investment.ts";
import { isInvestment, type Account, type Entry, type PricePoint, type Trade } from "./types.ts";

export type Holding = {
  account: Account;
  investment: boolean;
  value: number;
  /** Investments: cost of the units held. Balances: the balance itself, so allocation by cost still counts them. */
  cost: number;
  /** Null for a balance: cash and saving have no profit or loss. */
  pl: number | null;
  plPct: number | null;
  /** Profit locked in by sales; 0 for a balance. */
  realized: number;
  quantity: number | null;
  /** Price of one unit now (investments with a known price). */
  price: number | null;
  lastDate: string;
};

/** The dated values of one account, whichever way it is tracked. */
export function accountEntries(account: Account, entries: Entry[], trades: Trade[], prices: PricePoint[]): Entry[] {
  if (!isInvestment(account)) return entries.filter((e) => e.accountId === account.id).sort((a, b) => a.date.localeCompare(b.date));
  return investmentEntries(
    account.id,
    trades.filter((t) => t.accountId === account.id),
    prices.filter((p) => p.accountId === account.id),
  );
}

/** Current position of every account that has anything recorded. */
export function holdings(accounts: Account[], entries: Entry[], trades: Trade[], prices: PricePoint[]): Holding[] {
  const out: Holding[] = [];
  for (const account of accounts) {
    if (!isInvestment(account)) {
      const list = accountEntries(account, entries, trades, prices);
      const last = list[list.length - 1];
      if (!last) continue;
      out.push({ account, investment: false, value: last.value, cost: last.value, pl: null, plPct: null, realized: 0, quantity: null, price: null, lastDate: last.date });
      continue;
    }
    const mine = trades.filter((t) => t.accountId === account.id);
    if (mine.length === 0) continue;
    const r = replay(mine);
    const p = latestPrice(mine, prices.filter((x) => x.accountId === account.id));
    const value = r.quantity * (p?.price ?? 0);
    const pl = value - r.cost;
    out.push({
      account,
      investment: true,
      value,
      cost: r.cost,
      pl,
      plPct: r.cost > 0 ? pl / r.cost : null,
      realized: r.realized,
      quantity: r.quantity,
      price: p?.price ?? null,
      lastDate: p?.date ?? mine[mine.length - 1].date,
    });
  }
  return out;
}

export type Slice = { id: string; label: string; value: number };

/** Sums `metric` per group, in the order of `order`, dropping empty groups. */
export function slices(
  rows: Holding[],
  key: (h: Holding) => string,
  metric: (h: Holding) => number,
  order: readonly { id: string; label: string }[],
): Slice[] {
  return order
    .map((o) => ({ id: o.id, label: o.label, value: rows.filter((h) => key(h) === o.id).reduce((s, h) => s + metric(h), 0) }))
    .filter((s) => s.value > 0);
}
