// node --experimental-strip-types scripts/test-portfolio.mjs
import assert from "node:assert/strict";
import { deriveTrades, investmentEntries, latestPrice, priceHistory, replay, tradeCash } from "../lib/investment.ts";
import { holdings, slices } from "../lib/portfolio.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);
const acc = (id, type, categoryId = "x") => ({ id, name: `a${id}`, categoryId, categoryName: categoryId, type, liquidity: "days", archived: false });
const bal = (accountId, date, value) => ({ id: 0, accountId, date, value, contribution: 0, note: null });
let n = 0;
const tr = (accountId, date, side, quantity, price, fee = 0) => ({ id: ++n, accountId, date, side, quantity, price, fee, note: null });
const px = (accountId, date, price) => ({ id: 0, accountId, date, price });

// Average cost: buy 10 @100 and 10 @200 -> 20 units, avg 150.
let r = replay([tr(1, "2026-01-01", "buy", 10, 100), tr(1, "2026-02-01", "buy", 10, 200)]);
near(r.quantity, 20); near(r.avgCost, 150); near(r.cost, 3000);

// Selling 5 @ 200 realises 5*(200-150)=250 and leaves the average at 150.
r = replay([tr(1, "2026-01-01", "buy", 10, 100), tr(1, "2026-02-01", "buy", 10, 200), tr(1, "2026-03-01", "sell", 5, 200)]);
near(r.quantity, 15); near(r.realized, 250); near(r.avgCost, 150); assert.equal(r.ok, true);

// Selling more than held is flagged, and selling everything resets the cost.
assert.equal(replay([tr(1, "2026-01-01", "buy", 1, 10), tr(1, "2026-01-02", "sell", 2, 10)]).ok, false);
r = replay([tr(1, "2026-01-01", "buy", 2, 10), tr(1, "2026-01-02", "sell", 2, 15)]);
near(r.quantity, 0); near(r.cost, 0); near(r.realized, 10);

// Fees: a buy fee joins the cost, a sell fee comes off the proceeds.
r = replay([tr(1, "2026-01-01", "buy", 10, 100, 10), tr(1, "2026-02-01", "sell", 5, 120, 5)]);
near(r.avgCost, 101); near(r.realized, 595 - 505); near(r.cost, 505);

// Latest price: explicit price wins over the last trade, and falls back to the trade price.
const t1 = [tr(1, "2026-01-01", "buy", 10, 100)];
assert.deepEqual(latestPrice(t1, []), { price: 100, date: "2026-01-01" });
assert.deepEqual(latestPrice(t1, [px(1, "2026-02-01", 120)]), { price: 120, date: "2026-02-01" });

// Price history: trade prices appear on their day, and a manual price replaces the trade's that day.
const ph = priceHistory([tr(1, "2026-01-01", "buy", 1, 100), tr(1, "2026-02-01", "buy", 1, 110)], [{ id: 7, accountId: 1, date: "2026-02-01", price: 115 }, { id: 8, accountId: 1, date: "2026-03-01", price: 120 }]);
assert.deepEqual(ph.map((r) => [r.date, r.price, r.source]), [["2026-03-01", 120, "manual"], ["2026-02-01", 115, "manual"], ["2026-01-01", 100, "trade"]]);

// Entries for charts: value = units x price, contribution = cash in/out that day.
const es = investmentEntries(1, [...t1, tr(1, "2026-03-01", "sell", 4, 130)], [px(1, "2026-02-01", 120)]);
assert.deepEqual(es.map((e) => [e.date, e.value, e.contribution, e.cost]), [["2026-01-01", 1000, 1000, 1000], ["2026-02-01", 1200, 0, 1000], ["2026-03-01", 780, -520, 600]]);

// Holdings: balances have no P/L; investments do.
const accounts = [acc(1, "investment", "stocks"), acc(2, "cash", "cash"), acc(3, "investment", "gold")];
const rows = holdings(accounts, [bal(2, "2026-01-01", 300)], [tr(1, "2026-01-01", "buy", 10, 100)], [px(1, "2026-02-01", 150)]);
assert.equal(rows.length, 2); // account 3 has nothing recorded
near(rows[0].value, 1500); near(rows[0].cost, 1000); near(rows[0].pl, 500); near(rows[0].plPct, 0.5);
assert.equal(rows[1].pl, null); assert.equal(rows[1].plPct, null); near(rows[1].value, 300);

const order = [{ id: "cash", label: "Cash" }, { id: "stocks", label: "Stocks" }, { id: "gold", label: "Gold" }];
assert.deepEqual(slices(rows, (h) => h.account.categoryId, (h) => h.value, order).map((s) => [s.id, s.value]), [["cash", 300], ["stocks", 1500]]);
console.log("ok");

// Totals: each is the holding (units and their cost) at the end of its day; the trade it stands for is worked out from what came before.
{
  const tot = (id, date, units, cost, price = 1_000_000) => ({ id, accountId: 9, date, units, cost, price, note: null });
  const at = (ts, date) => replay(ts.filter((t) => t.date <= date));
  const sides = (ts) => ts.map((t) => `${t.side} ${Math.round(t.quantity * 1e8) / 1e8}`);

  // Entered out of order: 1 Jan 0.25 BTC, 1 Mar 0.50, then 1 Feb 0.70. Every date keeps its units and cost.
  let ts = deriveTrades([], [tot(1, "2025-01-01", 0.25, 250_000), tot(2, "2025-03-01", 0.5, 480_000), tot(3, "2025-02-01", 0.7, 700_000)]);
  assert.deepEqual(sides(ts), ["buy 0.25", "buy 0.45", "sell 0.2"]);
  near(at(ts, "2025-01-01").quantity, 0.25); near(at(ts, "2025-02-01").quantity, 0.7); near(at(ts, "2025-03-01").quantity, 0.5);
  near(at(ts, "2025-01-01").cost, 250_000); near(at(ts, "2025-02-01").cost, 700_000); near(at(ts, "2025-03-01").cost, 480_000);
  assert.equal(replay(ts).ok, true);
  assert.equal(ts[2].total.id, 2);
  // The buy paid in the rise in cost; the sale got 0.2 at the price and took 220,000 off the cost.
  near(tradeCash(ts[1]), 450_000); near(tradeCash(ts[2]), 200_000); near(at(ts, "2025-03-01").realized, 200_000 - 220_000);

  // Deleting the February total puts March back to buying 0.25 for 230,000.
  ts = deriveTrades([], [tot(1, "2025-01-01", 0.25, 250_000), tot(2, "2025-03-01", 0.5, 480_000)]);
  assert.deepEqual(sides(ts), ["buy 0.25", "buy 0.25"]); near(tradeCash(ts[1]), 230_000);

  // Entered trades count, including those on the same day as a total; a later total absorbs an earlier buy.
  ts = deriveTrades([tr(9, "2025-01-15", "buy", 0.1, 1_000_000), tr(9, "2025-03-01", "buy", 0.05, 1_000_000)],
    [tot(1, "2025-01-01", 0.25, 250_000), tot(2, "2025-03-01", 0.5, 500_000)]);
  near(at(ts, "2025-01-20").quantity, 0.35); near(at(ts, "2025-01-20").cost, 350_000);
  near(at(ts, "2025-03-01").quantity, 0.5); near(at(ts, "2025-03-01").cost, 500_000);
  assert.deepEqual(sides(ts.filter((t) => t.total)), ["buy 0.25", "buy 0.1"]);

  // A total that lowers the holding below a later sale is flagged, as an oversell would be.
  ts = deriveTrades([tr(9, "2025-01-01", "buy", 1, 10), tr(9, "2025-03-01", "sell", 0.8, 10)], [tot(1, "2025-02-01", 0.5, 5, 10)]);
  assert.equal(replay(ts).ok, false);

  // No change in units still records the price, and can still correct the cost.
  ts = deriveTrades([tr(9, "2025-01-01", "buy", 2, 10)], [tot(1, "2025-02-01", 2, 22, 15)]);
  near(ts[1].quantity, 0); near(latestPrice(ts, []).price, 15); near(replay(ts).cost, 22); near(tradeCash(ts[1]), 2);

  // Values over time follow the totals: 0.7 BTC at 1.2m on 1 Feb.
  const e = investmentEntries(9, deriveTrades([], [tot(1, "2025-01-01", 0.25, 250_000), tot(3, "2025-02-01", 0.7, 700_000, 1_200_000)]), []);
  near(e[1].value, 840_000); near(e[1].cost, 700_000); near(e[1].contribution, 450_000);
}
console.log("totals ok");

// Transfers: units move with their share of the cost at the sender's average; no profit taken, no money in or out overall.
{
  const xfer = (id, from, to, date, units, fee = 0) => ({ id, fromAccountId: from, toAccountId: to, date, units, fee, note: null });
  const of = (ts, acc, date = "9999-12-31") => replay(ts.filter((t) => t.accountId === acc && t.date <= date));
  // Exchange (1) buys 1 BTC at 1,000,000 then 1 at 2,000,000: average 1,500,000. Sends 0.5 to the wallet (2), 0.01 fee.
  const trades = [tr(1, "2025-01-01", "buy", 1, 1_000_000), tr(1, "2025-02-01", "buy", 1, 2_000_000)];
  let ts = deriveTrades(trades, [], [xfer(1, 1, 2, "2025-03-01", 0.5, 0.01)], [px(1, "2025-03-01", 3_000_000)]);
  const ex = of(ts, 1), wa = of(ts, 2);
  near(ex.quantity, 1.49); near(wa.quantity, 0.5);
  near(wa.cost, 750_000); near(wa.avgCost, 1_500_000);           // cost moved at the sender's average
  near(ex.avgCost, 1_500_000); near(ex.cost, 1.49 * 1_500_000);  // sender's average unchanged
  near(ex.realized, -15_000); near(wa.realized, 0);              // the fee is a small realised loss
  // The wallet takes the exchange's price that day; the exchange's own price history is untouched by it.
  assert.equal(latestPrice(ts.filter((t) => t.accountId === 2), []).price, 3_000_000);
  assert.equal(priceHistory(ts.filter((t) => t.accountId === 1), [px(1, "2025-03-01", 3_000_000)]).length, 3);
  // Performance: out of one, into the other, at that day's value; together they cancel.
  const flows = (acc) => investmentEntries(acc, ts.filter((t) => t.accountId === acc), acc === 1 ? [px(1, "2025-03-01", 3_000_000)] : [])
    .find((e) => e.date === "2025-03-01").contribution;
  near(flows(1), -1_500_000); near(flows(2), 1_500_000);

  // Sending more than held is flagged; a transfer entered for an earlier date moves a later total's difference.
  assert.equal(of(deriveTrades(trades, [], [xfer(1, 1, 2, "2025-01-15", 1.5)]), 1).ok, false);
  const tot = { id: 1, accountId: 2, date: "2025-04-01", units: 0.8, cost: 1_200_000, price: 3_000_000, note: null };
  ts = deriveTrades(trades, [tot], [xfer(1, 1, 2, "2025-03-01", 0.5)]);
  assert.equal(ts.find((t) => t.total).quantity, 0.3);
  near(of(ts, 2).quantity, 0.8); near(of(ts, 2).cost, 1_200_000);

  // A chain: the wallet sends on to cold storage (3) after a further buy on the wallet; cost follows each average.
  ts = deriveTrades([...trades, tr(2, "2025-03-10", "buy", 0.5, 2_500_000)], [], [xfer(1, 1, 2, "2025-03-01", 0.5), xfer(2, 2, 3, "2025-03-20", 1)]);
  near(of(ts, 3).cost, 750_000 + 1_250_000); near(of(ts, 2).quantity, 0);
}
console.log("transfers ok");
