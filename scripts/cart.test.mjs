// node --test scripts/cart.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { cartItems, toCart, toggleSlot } from "../lib/cart.ts";

const hall = { id: "vaj", name: "Vajihi Hall", type: "hall", active: true, rates: { morning: 10, evening: 12, fullDay: 20, multiDay: 15 } };
const other = { id: "muf", name: "Muffadal Hall", type: "hall", active: true, rates: { morning: 15, evening: 18, fullDay: 30 } };
const room = { id: "r1", name: "Room 1", type: "room", active: true, rates: { perDay: 5 } };
const off = { ...other, id: "off", active: false };
const venues = [hall, other, room, off];
const A = "2026-12-01", B = "2026-12-03";
const items = (c) => cartItems(c, venues);
const click = (c, v, d, s) => toggleSlot(items(c), v, d, s);

test("halls keep their own slot, sorted by date, gaps allowed", () => {
  const got = items(`vaj_${B}_M,muf_${A}_E`);
  assert.deepEqual(got.map((i) => [i.venueId, i.date, i.slot, i.rate]), [["muf", A, "E", 18], ["vaj", B, "M", 10]]);
});

test("morning + evening merge into full day at the full-day rate", () => {
  assert.deepEqual(items(`vaj_${A}_M,vaj_${A}_E`).map((i) => [i.slot, i.rate]), [["D", 20]]);
  assert.deepEqual(items(`vaj_${A}_D,vaj_${A}_M`).map((i) => i.slot), ["D"]);
});

test("multi-day rate applies per hall with more than one day", () => {
  assert.deepEqual(items(`vaj_${A}_D,vaj_${B}_D,muf_${A}_D`).map((i) => [i.venueId, i.rate]), [["vaj", 15], ["muf", 30], ["vaj", 15]]);
});

test("rooms are always full day", () => {
  assert.deepEqual(items(`r1_${A}_M`).map((i) => [i.slot, i.rate]), [["D", 5]]);
});

test("invalid carts throw", () => {
  for (const c of [`nope_${A}_M`, `off_${A}_M`, `vaj_${A}_X`, `vaj_2026-02-31_M`, `vaj_tomorrow_M`, `vaj_${A}_M_x`])
    assert.throws(() => items(c), undefined, c);
  assert.deepEqual(items(""), []);
});

test("clicks cycle: none, morning, both, evening, none", () => {
  let c = click("", "vaj", A, "M");
  assert.equal(c, `vaj_${A}_M`);
  c = click(c, "vaj", A, "E");
  assert.equal(c, `vaj_${A}_D`);
  c = click(c, "vaj", A, "M");
  assert.equal(c, `vaj_${A}_E`);
  c = click(c, "vaj", A, "E");
  assert.equal(c, "");
});

test("a click only touches its own hall and day", () => {
  const c = click(`muf_${A}_M,vaj_${B}_E`, "vaj", A, "M");
  assert.deepEqual(items(c).map((i) => [i.venueId, i.date, i.slot]), [["muf", A, "M"], ["vaj", A, "M"], ["vaj", B, "E"]]);
});

test("a room click toggles on and off", () => {
  const c = click("", "r1", A, "D");
  assert.equal(c, `r1_${A}_D`);
  assert.equal(click(c, "r1", A, "D"), "");
  assert.equal(toCart(items(c)), c);
});
