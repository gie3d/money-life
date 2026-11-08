// node --experimental-strip-types scripts/test-forecast.mjs
import assert from "node:assert/strict";
import { forecast } from "../lib/forecast.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} !~ ${b}`);
const pt = (date, value) => ({ date, value, cost: 0 });
const pay = (date, amount) => ({ date, amount, itemId: 1, name: "x" });

// 1,200,000 a year ago, 2,400,000 today: +100,000 a month.
const series = [pt("2025-11-08", 1_200_000), pt("2026-05-01", 1_800_000), pt("2026-11-08", 2_400_000)];
let f = forecast(series, "2026-11-08", [pay("2026-12-15", 50_000), pay("2027-03-01", 30_000), pay("2027-06-01", 999), pay("2026-10-01", 999)]);
near(f.monthly, 100_000); near(f.today, 2_400_000);
assert.deepEqual(f.payments.map((p) => p.date), ["2026-12-15", "2027-03-01"]); // past and beyond 6 months left out
near(f.end.trend, 3_000_000); near(f.end.afterPlans, 2_920_000);
assert.equal(f.end.date, "2027-05-08");
// History: ends of May..Oct 2026, then today, then 6 months ahead.
assert.deepEqual(f.points.map((p) => p.date).slice(0, 7), ["2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-08"]);
near(f.points[0].actual, 1_800_000); assert.equal(f.points[0].trend, null);
const dec = f.points.find((p) => p.date === "2026-12-08"); near(dec.trend, 2_500_000); near(dec.afterPlans, 2_500_000);
const jan = f.points.find((p) => p.date === "2027-01-08"); near(jan.afterPlans, 2_550_000);

// A new tracker (under a month) has no trend; a 3-month one averages over 3 months.
f = forecast([pt("2026-11-01", 500)], "2026-11-08", []);
near(f.monthly, 0); near(f.end.trend, 500); assert.equal(f.points[0].date, "2026-11-08");
f = forecast([pt("2026-08-08", 1000), pt("2026-11-08", 1300)], "2026-11-08", []);
assert.ok(Math.abs(f.monthly - 100) < 1.5, String(f.monthly));
console.log("forecast ok");
