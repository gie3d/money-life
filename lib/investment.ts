import type { Entry, PricePoint, Trade } from "./types";

export type Replay = {
  quantity: number;
  /** Cost of the units still held (average-cost method). */
  cost: number;
  avgCost: number;
  /** Profit already locked in by sales. */
  realized: number;
  /** False if some sale would sell more than was held at that moment. */
  ok: boolean;
};

const order = (a: Trade, b: Trade) => a.date.localeCompare(b.date) || a.id - b.id;

/** Cash that moved for a trade: a buy costs the price plus the fee, a sale pays the price less the fee. */
export const tradeCash = (t: Trade) => (t.side === "buy" ? t.quantity * t.price + t.fee : t.quantity * t.price - t.fee);

/**
 * Replays trades oldest first. A buy's fee is added to its cost; a sale's fee comes off its proceeds.
 * Selling removes cost at the running average, so the average of what is left is unchanged.
 */
export function replay(trades: Trade[]): Replay {
  let quantity = 0;
  let cost = 0;
  let realized = 0;
  let ok = true;
  for (const t of [...trades].sort(order)) {
    if (t.side === "buy") {
      quantity += t.quantity;
      cost += tradeCash(t);
    } else {
      if (t.quantity > quantity + 1e-9) ok = false;
      const avg = quantity > 0 ? cost / quantity : 0;
      realized += tradeCash(t) - avg * t.quantity;
      cost -= avg * t.quantity;
      quantity -= t.quantity;
      if (quantity < 1e-9) { quantity = 0; cost = 0; }
    }
  }
  return { quantity, cost, avgCost: quantity > 0 ? cost / quantity : 0, realized, ok };
}

/** The latest known price of one unit: an explicit price, or else what the last trade was done at. */
export function latestPrice(trades: Trade[], prices: PricePoint[]): { price: number; date: string } | null {
  const seen = new Map<string, number>();
  for (const t of [...trades].sort(order)) seen.set(t.date, t.price);
  for (const p of prices) seen.set(p.date, p.price); // an explicit price beats a trade on the same day
  const dates = [...seen.keys()].sort();
  const date = dates[dates.length - 1];
  return date ? { price: seen.get(date)!, date } : null;
}

/**
 * Dated values for an investment, in the same shape as a balance's entries, so the
 * performance and net-worth code can treat both alike. `contribution` is the cash
 * that went in (buys) or came out (sells) on that day.
 */
export function investmentEntries(accountId: number, trades: Trade[], prices: PricePoint[]): Entry[] {
  const dates = new Set([...trades.map((t) => t.date), ...prices.map((p) => p.date)]);
  const out: Entry[] = [];
  for (const date of [...dates].sort()) {
    const upTo = trades.filter((t) => t.date <= date);
    const price = latestPrice(upTo, prices.filter((p) => p.date <= date));
    if (!price) continue;
    const flow = trades
      .filter((t) => t.date === date)
      .reduce((s, t) => s + (t.side === "buy" ? 1 : -1) * tradeCash(t), 0);
    out.push({ id: 0, accountId, date, value: replay(upTo).quantity * price.price, contribution: flow, note: null });
  }
  return out;
}
