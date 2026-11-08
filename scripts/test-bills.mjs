// node --experimental-strip-types scripts/test-bills.mjs
import assert from "node:assert/strict";
import { dueWithin, monthly, nextDue, totals } from "../lib/bills.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);
const bill = (o) => ({ id: 1, name: "x", amount: 100, everyMonths: 1, firstDue: "2026-01-31", endDate: null, group: "Home", accountId: null, note: null, planAmount: null, planDrop: false, ...o });

// Next due: steps from the first payment, keeps the 31st, stops at the end date.
assert.equal(nextDue(bill({}), "2026-11-08"), "2026-11-30");
assert.equal(nextDue(bill({}), "2026-12-01"), "2026-12-31");
assert.equal(nextDue(bill({ everyMonths: 12, firstDue: "2025-03-15" }), "2026-11-08"), "2027-03-15");
assert.equal(nextDue(bill({ firstDue: "2027-02-01" }), "2026-11-08"), "2027-02-01");
assert.equal(nextDue(bill({ endDate: "2026-11-20" }), "2026-11-21"), null);

// Monthly: yearly spread over 12; the plan lowers the amount or drops the bill.
near(monthly(bill({ amount: 1200, everyMonths: 12 })).now, 100);
near(monthly(bill({ amount: 899, planAmount: 599 })).planned, 599);
near(monthly(bill({ amount: 899, planDrop: true })).planned, 0);

// Totals leave out ended bills; saving is now minus planned.
const t = totals([
  bill({ amount: 15000 }),                               // rent
  bill({ id: 2, amount: 899, planAmount: 599 }),          // internet, cheaper plan
  bill({ id: 3, amount: 2400, everyMonths: 12, planDrop: true }), // yearly subscription, dropped
  bill({ id: 4, amount: 500, endDate: "2026-01-01" }),    // ended
], "2026-11-08");
near(t.now, 15000 + 899 + 200); near(t.planned, 15000 + 599); near(t.saving, 500); assert.equal(t.count, 3);

// Due within 30 days, soonest first.
const due = dueWithin([bill({ id: 1, firstDue: "2026-01-25" }), bill({ id: 2, firstDue: "2026-01-10" }), bill({ id: 3, everyMonths: 12, firstDue: "2026-06-01" })], "2026-11-08", 30);
assert.deepEqual(due.map((d) => [d.bill.id, d.date]), [[2, "2026-11-10"], [1, "2026-11-25"]]);
console.log("bills ok");
