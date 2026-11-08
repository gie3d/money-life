// node --experimental-strip-types scripts/test-goals.mjs
import assert from "node:assert/strict";
import { combined, contributionAt, monthsBetween, path, reachDate, requiredMonthly, standing, targetValue, yearly, retirementPath } from "../lib/goals.ts";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} !~ ${b}`);
const plan = (o = {}) => ({
  startDate: "2026-01-01", startValue: 100_000, targetDate: "2036-01-01", targetMode: "amount", targetAmount: 1_000_000,
  monthlySpending: null, withdrawalRate: 0.04, expectedReturn: 0.06, inflation: 0.025, monthlyContribution: 5_000, contributionGrowth: 0, ...o,
});
const entry = (date, value, contribution = 0) => ({ id: 0, accountId: 1, date, value, contribution, note: null });

assert.equal(monthsBetween("2026-01-15", "2036-01-01"), 120);

// Target: the amount, or spending grown by inflation over the years, divided by the withdrawal rate.
near(targetValue(plan()), 1_000_000);
near(targetValue(plan({ targetMode: "spending", monthlySpending: 50_000, inflation: 0, startDate: "2026-01-01", targetDate: "2036-01-01" })), 15_000_000);
assert.ok(targetValue(plan({ targetMode: "spending", monthlySpending: 50_000 })) > 15_000_000 * 1.27);

// Contributions rise each full year.
near(contributionAt(plan({ contributionGrowth: 0.1 }), 12), 5_000); near(contributionAt(plan({ contributionGrowth: 0.1 }), 13), 5_500);

// Path with no return is start + contributions; with 6% a year, one year of the start value grows 6%.
let pts = path(plan({ expectedReturn: 0 }));
near(pts.at(-1).value, 100_000 + 120 * 5_000); near(pts.at(-1).contributed, 600_000); assert.equal(pts.length, 121);
near(path(plan({ monthlyContribution: 0 }), 0, 100_000, 12).at(-1).value, 106_000);

// Required monthly: carrying on at it lands exactly on the target.
const need = requiredMonthly(plan(), 0, 100_000);
near(path(plan({ monthlyContribution: need })).at(-1).value, 1_000_000, 1e-9);
assert.equal(requiredMonthly(plan(), 120, 100), null);

// Reach date: already there, or the first month at or past the target.
assert.equal(reachDate(plan(), 0, 2_000_000), "2026-01-01");
const reach = reachDate(plan(), 0, 100_000);
const at = path(plan(), 0, 100_000, 600).find((p) => p.date === reach);
assert.ok(at.value >= 1_000_000);

// Standing: 6 months in, ahead by 10,000 of which 4,000 more paid in than planned (no return to keep it simple).
const p0 = plan({ expectedReturn: 0 });
const lists = [[entry("2026-01-01", 100_000), entry("2026-03-01", 115_000, 15_000), entry("2026-06-20", 140_000, 19_000)]];
const s = standing(p0, lists, "2026-07-01");
assert.equal(s.k, 6); near(s.planned, 130_000); near(s.actual, 140_000); near(s.gap, 10_000);
near(s.plannedPaid, 30_000); near(s.actualPaid, 34_000); near(s.fromContributions, 4_000); near(s.fromReturns, 6_000);

// Yearly: the first year has actual figures to today; later years only the plan.
const ys = yearly(p0, lists, "2026-07-01");
assert.equal(ys[0].year, 2026); near(ys[0].actualPaid, 34_000); near(ys[0].actualEnd, 140_000); near(ys[0].plannedPaid, 30_000); near(ys[0].plannedEnd, 130_000); near(ys[0].actualGrowth, 6_000); near(ys[0].plannedGrowth, 0);
assert.equal(ys[1].actualPaid, null); assert.equal(ys.at(-1).year, 2036);

// Per asset: each grows at its own rate with its own monthly amount; the path adds them up.
{
  const pa = plan({ expectedReturn: 0, monthlyContribution: 0, assets: [
    { accountId: 1, startValue: 100_000, rate: 0.12, monthly: 0 },
    { accountId: 2, startValue: 50_000, rate: 0, monthly: 1_000 },
  ] });
  const one = path(pa, 0, undefined, 12).at(-1);
  near(one.value, 112_000 + 62_000); near(one.contributed, 12_000);
  // From today's actual values by account.
  near(path(pa, 0, new Map([[1, 200_000], [2, 0]]), 12).at(-1).value, 224_000 + 12_000);
  // A single amount is shared like the start values (2:1).
  near(path(pa, 0, 300_000, 12).at(-1).value, 224_000 + 112_000);
  // Required monthly is shared like the planned amounts, so landing on the target works per asset too.
  const need = requiredMonthly(pa, 0);
  const scaled = { ...pa, assets: pa.assets.map((a) => ({ ...a, monthly: a.monthly > 0 ? need : 0 })) };
  near(path(scaled).at(-1).value, 1_000_000, 1e-9);
  // Combined figures: rate weighted by value.
  const c = combined(pa.assets);
  near(c.startValue, 150_000); near(c.monthly, 1_000); near(c.rate, 0.08);
  assert.ok(reachDate(pa, 0) !== null);
}


// After the target date: grows at the rate, spending comes out (no inflation here): 1,200,000 at 0% less 10,000 a month lasts 120 months.
{
  const pr = plan({ expectedReturn: 0, inflation: 0, monthlySpending: 10_000, targetMode: "spending" });
  const r = retirementPath(pr, 1_200_000, "2056-01-01");
  assert.equal(r[0].date, "2036-01-01"); near(r[12].value, 1_080_000); near(r.at(-1).value, 0); assert.equal(r.at(-1).date, "2046-01-01");
}
console.log("goals ok");
