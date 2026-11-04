// node --test scripts/blocks.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dateToIso } from "../lib/misri.ts";
import { parseCsv } from "../lib/sheet.ts";
import { slotFromCells } from "../lib/types.ts";

test("template: every row is Date,Reason,Morning,Evening with a real date", () => {
  const [header, ...rows] = parseCsv(readFileSync("public/blocks-template.csv", "utf8"));
  assert.deepEqual(header, ["Date", "Reason", "Morning", "Evening"]);
  assert.equal(rows.length, 45);
  for (const r of rows) {
    assert.equal(r.length, 4, r.join("|"));
    assert.ok(dateToIso(r[0]), r[0]);
    assert.ok(r[1], r[0]);
    assert.ok(slotFromCells(r[2], r[3]), r[0]);
  }
  assert.equal(new Set(rows.map((r) => r[0])).size, rows.length);
});

test("Morning/Evening cells map to slot and blocking", () => {
  assert.deepEqual(slotFromCells("Y", "Y"), { slot: "D", blocking: true });
  assert.deepEqual(slotFromCells("y", " N "), { slot: "M", blocking: true });
  assert.deepEqual(slotFromCells("N", "Y"), { slot: "E", blocking: true });
  assert.deepEqual(slotFromCells("N", "N"), { slot: "D", blocking: false });
  assert.deepEqual(slotFromCells("", ""), { slot: "D", blocking: true }); // two-column sheets
  for (const [m, e] of [["Y", ""], ["", "N"], ["yes", "Y"]]) assert.equal(slotFromCells(m, e), null);
});

test("quoted cells keep their commas and escaped quotes", () => {
  assert.deepEqual(parseCsv('28/02/2027,"Milad: Dai, Syedna (TUS)"\r\n\r\na,"b ""c"" d",\n'), [
    ["28/02/2027", "Milad: Dai, Syedna (TUS)"],
    ["a", 'b "c" d', ""],
  ]);
});

test("dates: day comes first, impossible dates rejected", () => {
  assert.equal(dateToIso("02/12/2026"), "2026-12-02");
  assert.equal(dateToIso("2/3/2027"), "2027-03-02");
  assert.equal(dateToIso("02-12-2026"), "2026-12-02");
  assert.equal(dateToIso("2027-03-02"), "2027-03-02");
  for (const bad of ["31/02/2027", "12/13/2027", "Community Majlis", ""]) assert.equal(dateToIso(bad), "", bad);
});
