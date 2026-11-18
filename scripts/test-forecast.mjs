// node --experimental-strip-types scripts/test-forecast.mjs
import assert from "node:assert/strict";
import { forecast, layered, model, plannedProjection, project, projection, volatility } from "../lib/forecast.ts";

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
  const total = [pt("2025-11-08", 11_000), pt(T, 24_000)];
  const fm = forecast(total, T, [], 12, 12, [], { parts: [projection(cash), projection(inv)] });
  near(fm.end.trend, 25_000 + 12_100);
  const rows = layered(fm.points, [{ id: "a", series: [pt("2025-11-08", 1_000), pt(T, 13_000)], projection: projection(cash) }, { id: "b", series: [pt("2025-11-08", 10_000), pt(T, 11_000)], projection: projection(inv) }], T);
  rows.forEach((r, i) => { if (fm.points[i].trend !== null) near(r.a + r.b, fm.points[i].trend); });
}

// The likely range: from the month-to-month swings of the investments.
{
  const e = (date, value, contribution = 0) => ({ id: 0, accountId: 0, date, value, contribution, note: null });
  const T = "2026-11-08";
  // Steady +1% every month: no swing, so the range closes up on the line.
  const steady = [];
  for (let j = 12; j >= 0; j--) steady.push(e(new Date(Date.UTC(2026, 10 - j, 8)).toISOString().slice(0, 10), 1000 * 1.01 ** (12 - j)));
  near(volatility([{ entries: steady, investment: true }], T), 0);
  // Up 10%, down 10%, in turn: a wide swing.
  const choppy = [];
  for (let j = 12, v = 1000; j >= 0; j--, v *= j % 2 ? 1.1 : 0.9) choppy.push(e(new Date(Date.UTC(2026, 10 - j, 8)).toISOString().slice(0, 10), v));
  const vol = volatility([{ entries: choppy, investment: true }], T);
  assert.ok(vol > 0.09 && vol < 0.12, String(vol));
  // Cash doesn't swing the range, and under 3 months there's no range at all.
  assert.equal(volatility([{ entries: [e("2026-09-08", 1), e(T, 2)], investment: true }], T), null);
  near(volatility([{ entries: steady, investment: true }, { entries: [e("2025-11-08", 0), e("2026-05-08", 50_000), e(T, 9)], investment: false }], T), 0);
  // The band sits around the after-plans line, widens over time, and is lopsided (more room up than down).
  const m = { parts: [projection(model([{ entries: choppy, investment: true }], T))], volatility: vol };
  const f = forecast([pt("2025-11-08", 1000), pt(T, choppy.at(-1).value)], T, [pay("2027-01-01", 100)], 12, 12, [], m);
  const at = (d) => f.points.find((p) => p.date === d);
  assert.equal(at("2026-10-31").low, null);
  near(at(T).low, at(T).afterPlans);
  const k1 = at("2026-12-08"), k12 = f.points.at(-1);
  assert.ok(k1.low < k1.afterPlans && k1.high > k1.afterPlans);
  assert.ok(k12.high - k12.low > k1.high - k1.low);
  assert.ok(k12.high - k12.afterPlans > k12.afterPlans - k12.low);
  near(f.end.low, k12.low);
  // Without a volatility there is no band.
  assert.equal(forecast([pt(T, 1)], T, [], 6, 12, [], { parts: [projection(model([], T))] }).end.low, null);
}

// Carrying an asset on as its goal plans.
{
  const T = "2026-11-08";
  // 6% a year and 1,000 a month: after a year, 10,000 × 1.06 plus twelve payments grown at the monthly rate.
  const r = 1.06 ** (1 / 12) - 1;
  const p = plannedProjection(10_000, true, { rate: 0.06, monthly: 1_000, contributionGrowth: 0, startDate: "2026-01-01", targetDate: "2040-01-01" }, T);
  near(p.at(0), 10_000); near(p.at(1), 10_000 * (1 + r) + 1_000);
  near(p.at(12), 10_000 * 1.06 + 1_000 * ((1 + r) ** 12 - 1) / r);
  near(p.investedAt(12), p.at(12));
  // The monthly amount rises 10% each full year from the plan's start (Jan 2026): Jan 2027 is month 12, still year one; Feb 2027 is the first raised one.
  const g = plannedProjection(0, false, { rate: 0, monthly: 100, contributionGrowth: 0.1, startDate: "2026-01-01", targetDate: "2040-01-01" }, T);
  near(g.at(2), 200); near(g.at(3) - g.at(2), 110); near(g.investedAt(3), 0);
  // Payments stop after the target date; growth carries on.
  const end = plannedProjection(1_000, true, { rate: 0, monthly: 100, contributionGrowth: 0, startDate: "2026-01-01", targetDate: "2027-01-08" }, T);
  near(end.at(2), 1_200); near(end.at(6), 1_200);
}
console.log("forecast ok");
