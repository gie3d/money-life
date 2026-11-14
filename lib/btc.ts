import "server-only";
import { cache } from "react";
import { pool } from "./db";

/** The assets under a category named BTC that is an investment: the source of every BTC price. */
const IN_BTC = "JOIN categories c ON c.id = a.category_id WHERE a.user_id = $1 AND lower(c.name) = 'btc' AND c.type = 'investment'";

/**
 * Every price of one BTC (in the user's own currency) recorded on the assets under BTC: price entries, the price of
 * a trade, and the price on a "Total". Oldest first; none if there is no BTC category or nothing priced in it.
 */
export const btcRates = cache(async (userId: number): Promise<{ date: string; price: number }[] | null> => {
  const { rows } = await pool.query(
    `SELECT r.d::text AS date, r.price FROM (
       SELECT p.date AS d, p.price FROM prices p JOIN accounts a ON a.id = p.account_id ${IN_BTC}
       UNION ALL SELECT t.date, t.price FROM transactions t JOIN accounts a ON a.id = t.account_id ${IN_BTC}
       UNION ALL SELECT s.date, s.price FROM totals s JOIN accounts a ON a.id = s.account_id ${IN_BTC}
     ) r WHERE r.price > 0 ORDER BY r.d`,
    [userId],
  );
  return rows.length ? rows.map((r) => ({ date: r.date as string, price: Number(r.price) })) : null;
});

export type Fx = {
  /** An amount on a date, in BTC: at that date's price (the latest recorded on or before it; the first one, before any). */
  at: (amount: number, date: string) => number;
  /** An amount at today's price: the latest recorded on any asset under BTC. */
  now: (amount: number) => number;
};

/** The converter, or null when BTC Standard is off or can't be used (no BTC category, or no price on it). */
export const btcFx = cache(async (userId: number): Promise<Fx | null> => {
  const { rows } = await pool.query("SELECT btc_standard FROM users WHERE id = $1", [userId]);
  if (!rows[0]?.btc_standard) return null;
  const rates = await btcRates(userId);
  if (!rates) return null;
  const latest = rates[rates.length - 1].price;
  const rateOn = (date: string) => {
    let lo = 0, hi = rates.length - 1, found = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rates[mid].date <= date) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return rates[found].price;
  };
  return { at: (amount, date) => amount / rateOn(date), now: (amount) => amount / latest };
});
