import type { Entry, PricePoint, Total, Trade, Transfer } from "./types";

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

/** Trades worked out from a transfer get ids from here up: after the day's own trades, before its totals. */
export const TRANSFER_ID_BASE = 2 ** 44;
/** Trades worked out from a total get ids from here up, so they sort after the day's own trades and transfers. */
export const TOTAL_ID_BASE = 2 ** 45;
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;

/**
 * Merges the entered trades with the ones that "Total" entries and transfers stand for, oldest first.
 *
 * A total counts as the end of its day, after that day's own trades and transfers. Against the holding just
 * before: more units is a buy of the difference, paid for by the rise in cost; fewer is a sale of the difference
 * at the total's price. Either way the holding afterwards is exactly the units and cost entered.
 *
 * A transfer moves units from one asset to another with their share of the cost, at the sender's average cost
 * that day, so neither average changes and no profit is taken. A fee in units leaves the sender as a small
 * realised loss. The receiver gets the sender's latest price as its price that day, so it has a value at once.
 *
 * All of it is worked out from scratch, in date order across every asset (a transfer's cost depends on the
 * sender's history), so anything entered for an earlier date also moves what comes after.
 */
export function deriveTrades(trades: Trade[], totals: Total[], transfers: Transfer[] = [], prices: PricePoint[] = []): Trade[] {
  if (totals.length === 0 && transfers.length === 0) return trades;
  const derived: Trade[] = [];
  // Holding of an account at the end of `date`, up to (not including) the event being worked out.
  const stateOf = (accountId: number, date: string) =>
    replay([...trades.filter((t) => t.accountId === accountId && t.date <= date), ...derived.filter((t) => t.accountId === accountId)]);

  const events = [
    ...transfers.map((x) => ({ date: x.date, rank: 0, id: x.id, transfer: x })),
    ...totals.map((x) => ({ date: x.date, rank: 1, id: x.id, total: x })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank || a.id - b.id);

  for (const e of events) {
    if ("transfer" in e && e.transfer) {
      const x = e.transfer;
      const from = stateOf(x.fromAccountId, x.date);
      const cost = from.avgCost * x.units;
      const feeCost = from.avgCost * x.fee;
      const mine = (t: { accountId: number; date: string }) => t.accountId === x.fromAccountId && t.date <= x.date;
      const price = latestPrice([...trades.filter(mine), ...derived.filter(mine)], prices.filter(mine))?.price ?? 0;
      const base = { date: x.date, fee: 0, note: x.note, price };
      const detail = { id: x.id, units: x.units, fee: x.fee, cost, feeCost };
      derived.push(
        { ...base, id: TRANSFER_ID_BASE + x.id, accountId: x.fromAccountId, side: "sell", quantity: x.units + x.fee,
          transfer: { ...detail, direction: "out", otherAccountId: x.toAccountId } },
        { ...base, id: TRANSFER_ID_BASE + x.id, accountId: x.toAccountId, side: "buy", quantity: x.units,
          transfer: { ...detail, direction: "in", otherAccountId: x.fromAccountId } },
      );
    } else if ("total" in e && e.total) {
      const s = e.total;
      const before = stateOf(s.accountId, s.date);
      const diff = round8(s.units - before.quantity);
      const quantity = Math.abs(diff);
      const cash = diff < 0 ? quantity * s.price : s.cost - before.cost;
      derived.push({
        id: TOTAL_ID_BASE + s.id, accountId: s.accountId, date: s.date, side: diff < 0 ? "sell" : "buy", quantity,
        price: s.price, fee: 0, note: s.note, total: { id: s.id, units: s.units, cost: s.cost, cash },
      });
    }
  }
  return [...trades, ...derived].sort(order);
}

/**
 * Cash that moved for a trade: a buy costs the price plus the fee, a sale pays the price less the fee.
 * A transfer moves no cash, but counts as its value at that day's price going out of one asset and into the
 * other, so each asset's own performance isn't read as a loss or a gain; across assets the two cancel out.
 */
export const tradeCash = (t: Trade) =>
  t.transfer ? t.transfer.units * t.price
  : t.total ? t.total.cash
  : t.side === "buy" ? t.quantity * t.price + t.fee : t.quantity * t.price - t.fee;

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
    if (t.transfer) {
      // Units move with their share of the cost; a fee in units is lost, so its cost is a realised loss.
      if (t.transfer.direction === "in") {
        quantity += t.quantity;
        cost += t.transfer.cost;
      } else {
        if (t.quantity > quantity + 1e-9) ok = false;
        quantity -= t.quantity;
        cost -= t.transfer.cost + t.transfer.feeCost;
        realized -= t.transfer.feeCost;
        if (quantity < 1e-9) { quantity = 0; cost = 0; }
      }
      continue;
    }
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

/** Whether a trade's price counts as the price that day: not a transfer out, which carries the sender's own price. */
const setsPrice = (t: Trade) => !t.transfer || (t.transfer.direction === "in" && t.price > 0);

/** The latest known price of one unit: an explicit price, or else what the last trade was done at. */
export function latestPrice(trades: Trade[], prices: PricePoint[]): { price: number; date: string } | null {
  const seen = new Map<string, number>();
  for (const t of [...trades].sort(order)) if (setsPrice(t)) seen.set(t.date, t.price);
  for (const p of prices) seen.set(p.date, p.price); // an explicit price beats a trade on the same day
  const dates = [...seen.keys()].sort();
  const date = dates[dates.length - 1];
  return date ? { price: seen.get(date)!, date } : null;
}

export type PriceRow = { date: string; price: number; source: "trade" | "transfer" | "manual"; /** Only a manual price can be deleted by id. */ id?: number };

/**
 * Every known price of one unit, newest first: the price of each trade on its day, with a
 * price entered by hand taking the place of the trade's on the same day. This is the same
 * rule latestPrice() uses, so the history lists exactly what the valuation is built from.
 */
export function priceHistory(trades: Trade[], prices: PricePoint[]): PriceRow[] {
  const byDate = new Map<string, PriceRow>();
  for (const t of [...trades].sort(order)) if (setsPrice(t)) byDate.set(t.date, { date: t.date, price: t.price, source: t.transfer ? "transfer" : "trade" });
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
