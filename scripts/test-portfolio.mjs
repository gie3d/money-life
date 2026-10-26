// node --experimental-strip-types scripts/test-portfolio.mjs
import assert from "node:assert/strict";
import { investmentEntries, latestPrice, replay } from "../lib/investment.ts";
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

// Entries for charts: value = units x price, contribution = cash in/out that day.
const es = investmentEntries(1, [...t1, tr(1, "2026-03-01", "sell", 4, 130)], [px(1, "2026-02-01", 120)]);
assert.deepEqual(es.map((e) => [e.date, e.value, e.contribution]), [["2026-01-01", 1000, 1000], ["2026-02-01", 1200, 0], ["2026-03-01", 780, -520]]);

// Holdings: balances have no P/L; investments do.
const accounts = [acc(1, "investment", "stocks"), acc(2, "cash", "cash"), acc(3, "investment", "gold")];
const rows = holdings(accounts, [bal(2, "2026-01-01", 300)], [tr(1, "2026-01-01", "buy", 10, 100)], [px(1, "2026-02-01", 150)]);
assert.equal(rows.length, 2); // account 3 has nothing recorded
near(rows[0].value, 1500); near(rows[0].cost, 1000); near(rows[0].pl, 500); near(rows[0].plPct, 0.5);
assert.equal(rows[1].pl, null); assert.equal(rows[1].plPct, null); near(rows[1].value, 300);

const order = [{ id: "cash", label: "Cash" }, { id: "stocks", label: "Stocks" }, { id: "gold", label: "Gold" }];
assert.deepEqual(slices(rows, (h) => h.account.categoryId, (h) => h.value, order).map((s) => [s.id, s.value]), [["cash", 300], ["stocks", 1500]]);
console.log("ok");
