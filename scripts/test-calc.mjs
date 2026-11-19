// node --experimental-strip-types scripts/test-calc.mjs
// calc() lives in a client component; this reads its source and tests it on its own.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const src = readFileSync(new URL("../components/NumberInput.tsx", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export function calc"), src.indexOf("\n}\n", src.indexOf("export function calc")) + 2);
const calc = new Function(`${stripTypeScriptTypes(fn.replace("export ", ""))}; return calc;`)();

assert.equal(calc("15000*6"), 90000);
assert.equal(calc("15,000 x 6"), 90000);
assert.equal(calc("1200×12"), 14400);
assert.equal(calc("(500+250)*4"), 3000);
assert.equal(calc("100000-25000/2"), 87500);
assert.equal(calc("90000÷12"), 7500);
assert.equal(calc("10/3"), 3.33);
assert.equal(calc("-5+10"), 5);
assert.equal(calc("15000*"), null);
assert.equal(calc("(1+2"), null);
assert.equal(calc("1/0"), null);
assert.equal(calc(""), null);
console.log("calc ok");
