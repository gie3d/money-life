// node --experimental-strip-types scripts/test-tax.mjs
import assert from "node:assert/strict";
import { calculate, NO_DEDUCTIONS, progressive, readDeductions, rulesFor } from "../lib/tax.ts";

const near = (a, b, msg = "") => assert.ok(Math.abs(a - b) < 0.01, `${msg} ${a} !~ ${b}`);
const inc = (o) => ({ id: 1, type: "40_1", name: "x", amount: 0, kind: null, actualExpense: null, withheld: 0, separate: false, ...o });
const d = (o = {}) => ({ ...NO_DEDUCTIONS, ...o });

// Progressive rates: 150k free, then 5%, 10%, ...
near(progressive(150_000).tax, 0);
near(progressive(300_000).tax, 7_500);
near(progressive(500_000).tax, 27_500);
near(progressive(1_000_000).tax, 115_000);
near(progressive(6_000_000).tax, 1_265_000 + 350_000);
assert.equal(progressive(400_000).marginal, 0.1);

// Salary 600,000: expense 100,000 (capped), personal 60,000, SSO 9,000 → net 431,000 → 7,500 + 13,100 = 20,600.
let r = calculate(2025, [inc({ amount: 600_000, withheld: 15_000 })], d({ socialSecurity: 9_000 }));
near(r.expenseTotal, 100_000); near(r.net, 431_000); near(r.tax, 20_600); near(r.balance, 5_600);

// Social security cap by year: 9,000 in 2025, 10,500 in 2026.
near(calculate(2025, [inc({ amount: 600_000 })], d({ socialSecurity: 10_500 })).allowances.find((l) => l.key === "socialSecurity").allowed, 9_000);
near(calculate(2026, [inc({ amount: 600_000 })], d({ socialSecurity: 10_500 })).allowances.find((l) => l.key === "socialSecurity").allowed, 10_500);
assert.equal(rulesFor(2019).socialSecurityCap, 9_000); // before the first known year: the first rules

// 40(1) + 40(2) share the 100,000 cap; split in proportion.
r = calculate(2025, [inc({ amount: 150_000 }), inc({ id: 2, type: "40_2", amount: 50_000 })], d());
near(r.expenseTotal, 100_000); near(r.expenses[0].expense, 75_000); near(r.expenses[1].expense, 25_000);

// Rent: building 30%; actual expense replaces the rate.
r = calculate(2025, [inc({ type: "40_5", kind: "building", amount: 100_000 }), inc({ id: 2, type: "40_8", amount: 100_000, actualExpense: 20_000 })], d());
near(r.expenses[0].expense, 30_000); near(r.expenses[1].expense, 20_000);

// 40(4) taxed at source is left out, and its withholding isn't credited.
r = calculate(2025, [inc({ amount: 500_000 }), inc({ id: 2, type: "40_4", amount: 100_000, withheld: 10_000, separate: true })], d());
near(r.assessable, 500_000); near(r.withheld, 0);

// Children: two born 2018+, none before → 30,000 + 60,000.
near(calculate(2025, [inc({ amount: 1_000_000 })], d({ childrenFrom2018: 2 })).allowances.find((l) => l.key === "children").allowed, 90_000);
// One before 2018, one after → 30,000 + 60,000.
near(calculate(2025, [inc({ amount: 1_000_000 })], d({ childrenBefore2018: 1, childrenFrom2018: 1 })).allowances.find((l) => l.key === "children").allowed, 90_000);

// Life + health together up to 100,000.
r = calculate(2025, [inc({ amount: 2_000_000 })], d({ lifeInsurance: 90_000, healthInsurance: 25_000 }));
near(r.allowances.find((l) => l.key === "healthInsurance").allowed, 10_000);

// Retirement 500,000 cap: PVD 300k (15% of 2M ok), RMF 500k → RMF trimmed to 200k.
r = calculate(2025, [inc({ amount: 2_000_000 })], d({ providentFund: 300_000, rmf: 500_000 }));
near(r.retirementCut, 300_000); near(r.allowances.find((l) => l.key === "rmf").allowed, 200_000);
// Thai ESG sits outside it; SSF not deductible after 2024.
near(r.allowances.find((l) => l.key === "personal").allowed, 60_000);
near(calculate(2025, [inc({ amount: 2_000_000 })], d({ ssf: 100_000 })).allowances.find((l) => l.key === "ssf").allowed, 0);
near(calculate(2024, [inc({ amount: 2_000_000 })], d({ ssf: 100_000 })).allowances.find((l) => l.key === "ssf").allowed, 100_000);
near(calculate(2027, [inc({ amount: 2_000_000 })], d({ thaiEsg: 300_000 })).allowances.find((l) => l.key === "thaiEsg").allowed, 100_000);

// Easy e-Receipt: 50,000 in 2025, none in 2026.
near(calculate(2026, [inc({ amount: 600_000 })], d({ easyEReceipt: 50_000 })).allowances.find((l) => l.key === "easyEReceipt").allowed, 0);

// Donations: 10% of income after allowances; double first.
// 600k salary → 500k after expense → 440k after personal. Double 30k → 60k capped at 44k; general 10k ≤ (440−44)*10% = 39.6k.
r = calculate(2025, [inc({ amount: 600_000 })], d({ donationDouble: 30_000, donationGeneral: 10_000 }));
near(r.donations[0].allowed, 44_000); near(r.donations[1].allowed, 10_000); near(r.net, 386_000);

// Minimum tax: business 3,000,000 with actual expenses 2,900,000 → progressive small, 0.5% = 15,000 applies.
r = calculate(2025, [inc({ type: "40_8", amount: 3_000_000, actualExpense: 2_900_000 })], d());
assert.equal(r.minimumApplies, true); near(r.tax, 15_000);
// Under 5,000 it doesn't apply.
r = calculate(2025, [inc({ type: "40_8", amount: 500_000, actualExpense: 490_000 })], d());
assert.equal(r.minimumApplies, false); near(r.tax, 0);

// Allowances never take net income below zero.
r = calculate(2025, [inc({ amount: 100_000 })], d({ lifeInsurance: 100_000 }));
near(r.net, 0); near(r.tax, 0);

// Stored deductions: junk and missing keys become nothing.
assert.deepEqual(readDeductions({ rmf: "12", spouse: "yes", nope: 5, parents: -2 }), { ...NO_DEDUCTIONS, rmf: 12 });
console.log("tax ok");
