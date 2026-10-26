// node --experimental-strip-types scripts/test-plan.mjs
import assert from "node:assert/strict";
import { addMonths, payments, schedule } from "../lib/plan.ts";

const item = (id, name, amount, frequency, startDate, occurrences = 1) => ({ id, planId: 1, name, amount, frequency, startDate, occurrences });

// Month arithmetic clamps to the end of a short month, and returns to the 31st afterwards.
assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
const monthly31 = payments([item(1, "x", 1, "monthly", "2026-01-31", 3)]).map((p) => p.date);
assert.deepEqual(monthly31, ["2026-01-31", "2026-02-28", "2026-03-31"]);

// A car: down payment once, then 4 monthly instalments, and a yearly insurance.
const pay = payments([
  item(1, "Down payment", 200000, "once", "2026-12-15"),
  item(2, "Instalment", 15000, "monthly", "2027-01-05", 4),
  item(3, "Insurance", 20000, "yearly", "2027-01-20", 2),
]);
assert.equal(pay.length, 1 + 4 + 2);
assert.deepEqual(pay.map((p) => p.date), ["2026-12-15", "2027-01-05", "2027-01-20", "2027-02-05", "2027-03-05", "2027-04-05", "2028-01-20"]);

const s = schedule(pay, 250000, 10000, "2026-10-26");
assert.equal(s.total, 200000 + 60000 + 40000);
assert.equal(s.remaining, s.total);
assert.equal(s.rows[0].month, "2026-10");
assert.equal(s.rows.at(-1).month, "2028-01");
// Dec 2026: funds 250000 + 2 months of saving, less the 200000 down payment.
const dec = s.rows.find((r) => r.month === "2026-12");
assert.equal(dec.funds, 270000); assert.equal(dec.balance, 70000);
// January adds 15000 + 20000: 70000 + 10000 - 35000 = 45000.
assert.equal(s.rows.find((r) => r.month === "2027-01").balance, 45000);
assert.equal(s.shortFrom, null);

// Without saving it runs out: 250000 - 200000 - 35000 - 15000 = 0, then 15000 more is short.
const tight = schedule(pay, 250000, 0, "2026-10-26");
assert.equal(tight.shortFrom, "2027-03");
assert.deepEqual(tight.low.month, "2028-01"); assert.equal(tight.low.balance, 250000 - 300000);

// Payments before today are not asked of the funds again.
const mid = schedule(pay, 100000, 0, "2027-01-10");
assert.equal(mid.past.length, 2);
assert.equal(mid.remaining, mid.total - 215000);
assert.equal(schedule([], 5, 0, "2026-10-26").rows.length, 0);
console.log("ok");
