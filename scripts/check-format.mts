// Self-check for IST date helpers: node --experimental-strip-types scripts/check-format.mts
import assert from "node:assert/strict";
import { dmy, dmyhm, ist, istMidnight } from "../lib/format.ts";

assert.equal(ist("2026-10-31T20:31:00.000Z").slice(0, 16), "2026-11-01T02:01"); // UTC evening = next IST morning
assert.equal(dmyhm("2026-10-31T20:31:00.000Z"), "01-11-2026 02:01");
assert.equal(dmy("2027-03-15"), "15-03-2027"); // plain dates are not shifted
assert.equal(istMidnight("2026-11-01"), "2026-10-31T18:30:00.000Z");
console.log("format ok");
