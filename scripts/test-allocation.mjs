// node --experimental-strip-types scripts/test-allocation.mjs
import assert from "node:assert/strict";
import { drift } from "../lib/allocation.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

// 60 / 30 / 10 now, aiming for 50 / 40 and no target on cash.
const d = drift([
  { id: "stocks", value: 600, target: 0.5 },
  { id: "bonds", value: 300, target: 0.4 },
  { id: "cash", value: 100, target: null },
]);
near(d.total, 1000); near(d.targetSum, 0.9);
const [stocks, bonds, cash] = d.rows;
near(stocks.share, 0.6); near(stocks.diff, 0.1); near(stocks.toTarget, -100);
near(bonds.diff, -0.1); near(bonds.toTarget, 100);
assert.equal(cash.diff, null); assert.equal(cash.toTarget, null); near(cash.share, 0.1);
// Ties go to the first; the furthest off is the largest gap either way.
assert.equal(d.furthest.id, "stocks");
assert.equal(drift([{ id: "a", value: 900, target: 0.95 }, { id: "b", value: 100, target: 0 }]).furthest.id, "b");
// A target on a category with nothing in it yet: all of it to move in.
const empty = drift([{ id: "gold", value: 0, target: 0.1 }, { id: "x", value: 500, target: null }]);
near(empty.rows[0].toTarget, 50); near(empty.rows[0].diff, -0.1);
// Nothing at all: shares are 0, no division by zero.
near(drift([{ id: "a", value: 0, target: 0.5 }]).rows[0].share, 0);
assert.equal(drift([{ id: "a", value: 5, target: null }]).furthest, null);

console.log("allocation ok");
