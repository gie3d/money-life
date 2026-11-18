// node --experimental-strip-types scripts/test-forecast.mjs
import assert from "node:assert/strict";
import { combined, forecast, layered, model, project } from "../lib/forecast.ts";

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
// Twelve back and twelve ahead: history from the end of Nov last year, forecast a year on, payments within the year.
{
  const f12 = forecast(series, "2026-11-08", [pay("2027-06-01", 999), pay("2027-12-01", 1)], 12);
  assert.equal(f12.points[0].date, "2025-11-30");
  assert.equal(f12.points.at(-1).date, "2027-11-08");
  assert.equal(f12.points.length, 12 + 1 + 12);
  near(f12.end.trend, 2_400_000 + 12 * 100_000); near(f12.end.afterPlans, 2_400_000 + 12 * 100_000 - 999);
}
// Plan income adds to the line as it falls due: a one-time 10,000 and 5,000 a month from January.
{
  const inc = [pay("2026-12-01", 10_000), pay("2027-01-15", 5_000), pay("2027-02-15", 5_000), pay("2026-10-01", 777)];
  const fi = forecast(series, "2026-11-08", [pay("2026-12-15", 50_000)], 6, 12, inc);
  assert.deepEqual(fi.income.map((p) => p.date), ["2026-12-01", "2027-01-15", "2027-02-15"]);
  near(fi.points.find((p) => p.date === "2026-12-08").afterPlans, 2_500_000 + 10_000);
  near(fi.end.afterPlans, 3_000_000 - 50_000 + 20_000);
  near(fi.end.trend, 3_000_000);
}

// The model: money put in, and investment growth, carried on separately.
{
  const e = (date, value, contribution = 0) => ({ id: 0, accountId: 0, date, value, contribution, note: null });
  const T = "2026-11-08";
  // Cash only: +1,000 a month is all money put in.
  const cash = model([{ entries: [e("2025-11-08", 1_000), e(T, 13_000)], investment: false }], T);
  near(cash.saved, 1_000); near(cash.rate, 0); near(project(cash, 12), 25_000);
  // An investment up 10% with nothing paid in: all growth, compounding.
  const inv = model([{ entries: [e("2025-11-08", 10_000), e(T, 11_000)], investment: true }], T);
  near(inv.saved, 0); near((1 + inv.rate) ** 12, 1.1); near(project(inv, 12), 12_100);
  // A 9,000 deposit half way through isn't growth: of the 10,000 rise, 9,000 was put in.
  const dep = model([{ entries: [e("2025-11-08", 10_000), e("2026-05-08", 19_500, 9_000), e(T, 20_000)], investment: true }], T);
  near(dep.saved * 12, 9_000); assert.ok(dep.rate > 0 && (1 + dep.rate) ** 12 < 1.1, String(dep.rate));
  // Cash moved into a new investment is neither saved nor gained; only the investment's rise is growth.
  const moved = model([
    { entries: [e("2025-11-08", 10_000), e("2026-05-08", 0)], investment: false },
    { entries: [e("2026-05-08", 10_000, 10_000), e(T, 10_500)], investment: true },
  ], T);
  near(moved.saved, 0); assert.ok(moved.rate > 0);
  // Under a month of history: no trend.
  near(model([{ entries: [e("2026-11-01", 5)], investment: false }], T).saved, 0);
  // Layers add up to the total trend, and the forecast uses the model.
  const both = combined([cash, inv]);
  const total = [pt("2025-11-08", 11_000), pt(T, 24_000)];
  const fm = forecast(total, T, [], 12, 12, [], both);
  near(fm.end.trend, 25_000 + 12_100);
  const rows = layered(fm.points, [{ id: "a", series: [pt("2025-11-08", 1_000), pt(T, 13_000)], model: cash }, { id: "b", series: [pt("2025-11-08", 10_000), pt(T, 11_000)], model: inv }], T);
  rows.forEach((r, i) => { if (fm.points[i].trend !== null) near(r.a + r.b, fm.points[i].trend); });
}
console.log("forecast ok");
