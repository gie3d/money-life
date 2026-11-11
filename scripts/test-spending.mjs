// node --experimental-strip-types scripts/test-spending.mjs
import assert from "node:assert/strict";
import { amountOf, byCategory, change, compareMonth, compareYear, monthsBetween, monthTotals, shiftMonth } from "../lib/spending.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

assert.equal(shiftMonth("2026-01", -1), "2025-12");
assert.equal(shiftMonth("2026-11", 2), "2027-01");
assert.deepEqual(monthsBetween("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);

// Everyday: one amount per category per month.
const m = (categoryId, month, amount) => ({ categoryId, month, amount });
const rows = [
  m(1, "2026-08", 5000), m(2, "2026-08", 1000), // first month recorded: Aug
  m(1, "2026-09", 6000),
  // Oct: not filled in, so it is left out of the average
  m(1, "2026-11", 4000), m(2, "2026-11", 2000),
];
assert.equal(monthTotals(rows).get("2026-08"), 6000);
assert.equal(amountOf(rows, 2, "2026-09"), 0);
const nov = compareMonth(rows, "2026-11");
near(nov.total, 6000); assert.equal(nov.prevTotal, null); // nothing in Oct to compare with
assert.equal(nov.averageMonths, 2); near(nov.average, (6000 + 6000) / 2);
const sep = compareMonth(rows, "2026-09");
near(sep.prevTotal, 6000); assert.equal(sep.averageMonths, 1); near(sep.average, 6000);
assert.equal(compareMonth(rows, "2026-08").average, null);
assert.equal(compareMonth([], "2026-11").average, null);

// Hobbies: totals by hobby, largest first.
let id = 0;
const s = (date, amount, category) => ({ id: ++id, date, amount, category, name: "x" });
assert.deepEqual(byCategory([s("2026-01-01", 10, "A"), s("2026-02-01", 30, "B"), s("2026-03-01", 5, "A")]).map((c) => [c.category, c.total, c.count]),
  [["B", 30, 1], ["A", 15, 2]]);

// Years: same part of last year while running; average of all years before.
const h = [s("2024-06-01", 1000, "Travel"), s("2025-03-01", 500, "Gadgets"), s("2025-12-20", 2000, "Travel"), s("2026-04-01", 800, "Travel")];
const y = compareYear(h, "2026", "2026-11-12");
near(y.total, 800); near(y.prevTotal, 2500); near(y.prevSoFar, 500); assert.equal(y.averageYears, 2); near(y.average, 1750);
assert.equal(compareYear(h, "2025", "2026-11-12").prevSoFar, null);

near(change(120, 100), 0.2); assert.equal(change(5, 0), null); assert.equal(change(5, null), null);
console.log("spending ok");
