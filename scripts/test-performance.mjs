// node --experimental-strip-types scripts/test-performance.mjs
import assert from "node:assert/strict";
import { accountPerformance, netWorthSeries, periodStart } from "../lib/performance.ts";

const e = (date, value, contribution = 0) => ({ id: 0, accountId: 1, date, value, contribution, note: null });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

// Pure growth, no money moved: 1000 -> 1100 is +10%.
let p = accountPerformance([e("2026-01-01", 1000), e("2026-02-01", 1100)], "2026-01-01", "2026-02-01");
near(p.gain, 100); near(p.returnPct, 0.1);

// Paying 500 in must not count as performance.
p = accountPerformance([e("2026-01-01", 1000), e("2026-01-16", 1550, 500), e("2026-02-01", 1600)], "2026-01-01", "2026-02-01");
near(p.gain, 100); near(p.contributions, 500);
assert.ok(p.returnPct < 0.1 && p.returnPct > 0.07);

// Window opens on the last entry at or before `from`.
p = accountPerformance([e("2026-01-01", 1000), e("2026-03-01", 1200), e("2026-04-01", 1260)], "2026-03-15", "2026-04-01");
near(p.start, 1200); near(p.gain, 60);

// A single entry has no return to speak of.
assert.equal(accountPerformance([e("2026-01-01", 1000)], "2026-01-01", "2026-02-01").returnPct, null);
assert.equal(accountPerformance([e("2026-05-01", 1)], "2026-01-01", "2026-02-01"), null);

// Net worth carries each account's last value forward.
const a = [e("2026-01-01", 100), e("2026-03-01", 150, 20)];
const b = [e("2026-02-01", 50)];
const s = netWorthSeries([a, b], null, "2026-12-31");
assert.deepEqual(s.map((x) => x.value), [100, 150, 200]);
assert.deepEqual(s.map((x) => x.invested), [100, 150, 170]);

assert.equal(periodStart("YTD", "2026-10-26"), "2026-01-01");
assert.equal(periodStart("3M", "2026-10-26"), "2026-07-26");
assert.equal(periodStart("ALL", "2026-10-26"), null);
console.log("ok");
