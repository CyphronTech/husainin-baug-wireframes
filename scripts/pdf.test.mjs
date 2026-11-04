// node --test scripts/pdf.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { textPdf } from "../lib/pdf.ts";

const lines = (n) => Array.from({ length: n }, (_, i) => ({ text: `line ${i}` }));

test("one page while it fits, with a valid xref", () => {
  const pdf = textPdf(lines(5)).toString("latin1");
  assert.match(pdf, /\/Count 1 >>/);
  const xref = +pdf.match(/startxref\n(\d+)/)[1];
  assert.equal(pdf.slice(xref, xref + 4), "xref");
});

test("long documents spill onto new pages and lose no line", () => {
  const pdf = textPdf(lines(100)).toString("latin1");
  assert.match(pdf, /\/Count 3 >>/);
  for (let i = 0; i < 100; i++) assert.ok(pdf.includes(`(line ${i})`), `line ${i}`);
  for (const [, y] of pdf.matchAll(/50 (-?\d+) Td/g)) assert.ok(+y >= 50, `y ${y} is off the page`);
});

test("rupee sign and non-Latin text stay inside the PDF's character set", () => {
  const pdf = textPdf([{ text: "₹ 1,000 — (x)" }]).toString("latin1");
  assert.ok(pdf.includes("(Rs. 1,000 ? \\(x\\))"));
});
