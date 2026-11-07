// Salary parsing for forms. Run: node --no-warnings tests/forms.test.mjs
import assert from "node:assert/strict";
import { parseRupees } from "../lib/forms.ts";

const v = (s) => parseRupees(s).value;
const err = (s) => parseRupees(s).error;
let n = 0;
const eq = (a, b) => (assert.equal(a, b), n++);

eq(v("24"), 24_00_000);
eq(v("24.5"), 24_50_000);
eq(v("24 L"), 24_00_000);
eq(v("24 lakhs"), 24_00_000);
eq(v("24LPA"), 24_00_000);
eq(v("2.4 Cr"), 2_40_00_000);
eq(v("24,00,000"), 24_00_000);
eq(v("₹ 24,00,000"), 24_00_000);
eq(v("Rs. 2400000"), 24_00_000);
eq(v("350k"), 3_50_000);
eq(v(""), null);
eq(v("  "), null);
assert.ok(err("5000")); n++; // lakhs or rupees?
assert.ok(err("30-35")); n++;
assert.ok(err("30 to 35 L")); n++;
assert.ok(err("about 30")); n++;
assert.ok(err("99999999999999")); n++; // the overflow that broke a call save
eq(err("24"), undefined);
console.log(`${n} form checks passed`);
