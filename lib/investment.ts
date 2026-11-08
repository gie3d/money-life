import type { Entry, PricePoint, Total, Trade } from "./types";

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

/** Trades worked out from a total get ids from here up, so they sort after the day's own trades. */
export const TOTAL_ID_BASE = 2 ** 45;
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;

/**
 * Turns each "Total" entry into the trade it stands for and merges them with the entered trades.
 * A total counts as the end of its day, after that day's own trades. Against the holding just before:
 * more units is a buy of the difference, paid for by the rise in cost; fewer is a sale of the difference
 * at the total's price. Either way the holding afterwards is exactly the units and cost entered. This is
 * worked out from scratch each time, so a total entered for an earlier date also moves the later ones.
 * A total with no change in units still gives a zero-unit trade, which carries its price and cost.
 */
export function applyTotals(trades: Trade[], totals: Total[]): Trade[] {
  if (totals.length === 0) return trades;
  const out = [...trades];
  for (const accountId of new Set(totals.map((t) => t.accountId))) {
    const mine = trades.filter((t) => t.accountId === accountId);
    const derived: Trade[] = [];
    for (const s of totals.filter((t) => t.accountId === accountId).sort((a, b) => a.date.localeCompare(b.date))) {
      const before = replay([...mine.filter((t) => t.date <= s.date), ...derived]);
      const diff = round8(s.units - before.quantity);
      const quantity = Math.abs(diff);
      const cash = diff < 0 ? quantity * s.price : s.cost - before.cost;
      derived.push({
        id: TOTAL_ID_BASE + s.id, accountId, date: s.date, side: diff < 0 ? "sell" : "buy", quantity,
        price: s.price, fee: 0, note: s.note, total: { id: s.id, units: s.units, cost: s.cost, cash },
      });
    }
    out.push(...derived);
  }
  return out.sort(order);
}

/** Cash that moved for a trade: a buy costs the price plus the fee, a sale pays the price less the fee. */
export const tradeCash = (t: Trade) =>
  t.total ? t.total.cash : t.side === "buy" ? t.quantity * t.price + t.fee : t.quantity * t.price - t.fee;

/**
 * Replays trades oldest first. A buy's fee is added to its cost; a sale's fee comes off its proceeds.
 * Selling removes cost at the running average, so the average of what is left is unchanged.
 * A trade from a "Total" entry instead sets the cost to the one entered; for a sale, the profit
 * locked in is what the units fetched less the cost that came off.
 */
export function replay(trades: Trade[]): Replay {
  let quantity = 0;
  let cost = 0;
  let realized = 0;
  let ok = true;
  for (const t of [...trades].sort(order)) {
    if (t.total) {
      if (t.side === "sell") realized += tradeCash(t) - (cost - t.total.cost);
      quantity = t.total.units;
      cost = t.total.cost;
      continue;
    }
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

export type PriceRow = { date: string; price: number; source: "trade" | "manual"; /** Only a manual price can be deleted by id. */ id?: number };

/**
 * Every known price of one unit, newest first: the price of each trade on its day, with a
 * price entered by hand taking the place of the trade's on the same day. This is the same
 * rule latestPrice() uses, so the history lists exactly what the valuation is built from.
 */
export function priceHistory(trades: Trade[], prices: PricePoint[]): PriceRow[] {
  const byDate = new Map<string, PriceRow>();
  for (const t of [...trades].sort(order)) byDate.set(t.date, { date: t.date, price: t.price, source: "trade" });
  for (const p of prices) byDate.set(p.date, { date: p.date, price: p.price, source: "manual", id: p.id });
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
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
    const held = replay(upTo);
    out.push({ id: 0, accountId, date, value: held.quantity * price.price, contribution: flow, cost: held.cost, note: null });
  }
  return out;
}
