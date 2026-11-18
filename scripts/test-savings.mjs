// node --experimental-strip-types scripts/test-savings.mjs
import assert from "node:assert/strict";
import { savedIn, savingsRate } from "../lib/savings.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);
const inc = (month, amount) => ({ month, amount });
const m = (categoryId, month, amount) => ({ categoryId, month, amount });
const hob = (date, amount) => ({ date, amount });
const bill = (amount, everyMonths, firstDue = "2026-01-01", endDate = null) => ({ id: 1, name: "b", amount, everyMonths, firstDue, endDate, group: "Home", accountId: null, note: null, planAmount: null, planDrop: false });

const income = [inc("2026-09", 50_000), inc("2026-10", 100_000), inc("2026-11", 1)];
const everyday = [m(1, "2026-09", 20_000), m(2, "2026-09", 5_000), m(1, "2026-10", 30_000), m(1, "2026-08", 40_000)];
const hobbies = [hob("2026-10-12", 10_000), hob("2026-09-30", 0), hob("2026-11-01", 999)];
const bills = [bill(2_000, 1), bill(12_000, 12), bill(5_000, 1, "2026-10-15"), bill(9_999, 1, "2026-01-01", "2026-06-30")];

// September: 50,000 in; 25,000 everyday, 2,000 + 1,000 in bills (the October one hadn't started, the June one had ended).
let s = savedIn("2026-09", income, everyday, hobbies, bills);
near(s.spent, 28_000); near(s.saved, 22_000); near(s.rate, 0.44);
// October: the new bill counts from its month on, and the hobby bought then.
s = savedIn("2026-10", income, everyday, hobbies, bills);
near(s.spent, 30_000 + 10_000 + 8_000); near(s.saved, 52_000);
// No income recorded: nothing to compare with.
assert.equal(savedIn("2026-08", income, everyday, hobbies, bills), null);
// A month of spending more than came in.
near(savedIn("2026-09", [inc("2026-09", 10_000)], everyday, [], []).rate, -1.5);

// The rate over whole months: Aug has no income and Nov is still going, so Sep and Oct, weighted by income.
const r = savingsRate("2026-11-18", income, everyday, hobbies, bills);
assert.deepEqual(r.months.map((x) => x.month), ["2026-09", "2026-10"]);
near(r.income, 150_000); near(r.saved, 74_000); near(r.rate, 74_000 / 150_000); near(r.perMonth, 37_000);
assert.equal(savingsRate("2026-11-18", [], everyday, hobbies, bills).rate, null);

console.log("savings ok");
