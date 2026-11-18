// node --experimental-strip-types scripts/test-runway.mjs
import assert from "node:assert/strict";
import { runway } from "../lib/runway.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);
const m = (categoryId, month, amount) => ({ categoryId, month, amount });
const bill = (amount, everyMonths, endDate = null) => ({ id: 1, name: "b", amount, everyMonths, firstDue: "2026-01-01", endDate, group: "Home", accountId: null, note: null, planAmount: null, planDrop: false });
const T = "2026-11-18";

const assets = [
  { liquidity: "immediate", value: 60_000 },
  { liquidity: "days", value: 30_000 },
  { liquidity: "months", value: 500_000 }, // a fund that takes months to sell: not counted
  { liquidity: "retirement", value: 1_000_000 },
];
const cats = [{ id: 1, tier: "must" }, { id: 2, tier: "need" }, { id: 3, tier: "want" }, { id: 4, tier: null }];
const spending = [
  // Sep and Oct recorded; Aug left empty (not filled in, so not an average-lowering zero); Nov is this month, still going.
  m(1, "2026-09", 10_000), m(2, "2026-09", 4_000), m(3, "2026-09", 6_000), m(4, "2026-09", 1_000),
  m(1, "2026-10", 12_000), m(2, "2026-10", 2_000), m(3, "2026-10", 4_000), m(4, "2026-10", 1_000),
  m(1, "2026-11", 99_999),
  // Older than 6 whole months: left out.
  m(1, "2026-04", 99_999),
];
const r = runway(assets, cats, spending, [bill(3_000, 1), bill(12_000, 12), bill(5_000, 1, "2026-06-01")], T);
near(r.liquid, 90_000);
assert.equal(r.basisMonths, 2);
// Must + Need + Not sorted: (15,000 + 15,000) / 2 = 15,000; bills still running: 3,000 + 1,000 a month.
near(r.essentials, 19_000);
near(r.usual, 19_000 + 5_000);
near(r.essentialMonths, 90_000 / 19_000);
near(r.usualMonths, 90_000 / 24_000);

// Nothing recorded and no bills: nothing to divide by.
const none = runway(assets, cats, [], [], T);
assert.equal(none.essentialMonths, null); near(none.essentials, 0); assert.equal(none.basisMonths, 0);
// Bills alone still give a runway.
near(runway(assets, cats, [], [bill(9_000, 1)], T).essentialMonths, 10);

console.log("runway ok");
