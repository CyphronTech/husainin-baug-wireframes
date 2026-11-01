import type { Item, Slot, Venue } from "./types";

// shortcut: one Firestore transaction holds ≤500 writes, and every line locks 1–2 slots. Also keeps the cart URL short.
const MAX_LINES = 60;

function rateFor(v: Venue, slot: Slot, multiDay: boolean) {
  const r = v.rates;
  const rate = v.type === "room" ? r.perDay : slot === "M" ? r.morning : slot === "E" ? r.evening : multiDay && r.multiDay ? r.multiDay : r.fullDay;
  if (rate == null) throw new Error(`No rate set for ${v.name}`);
  return rate;
}

const realDate = (d = "") => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)) && new Date(d).toISOString().startsWith(d);

/**
 * Cart string → priced items, sorted by date. A cart is "venue_date_slot,…", spelled like a lock id.
 * Morning + Evening of one hall on one day become one Full day line. Comes from the URL: throws on anything invalid.
 */
export function cartItems(cart: string, venues: Venue[]): Item[] {
  const lines = new Map<string, { v: Venue; date: string; slot: Slot }>();
  for (const line of cart.split(",").filter(Boolean)) {
    const [venueId, date, slot, extra] = line.split("_");
    if (extra !== undefined || !realDate(date) || !["M", "E", "D"].includes(slot)) throw new Error("The cart has an invalid line");
    const v = venues.find((x) => x.id === venueId && x.active);
    if (!v) throw new Error("A hall or room in the cart is no longer available");
    const had = lines.get(`${venueId}_${date}`)?.slot;
    lines.set(`${venueId}_${date}`, { v, date, slot: v.type === "room" || (had && had !== slot) ? "D" : (slot as Slot) });
  }
  if (lines.size > MAX_LINES) throw new Error(`Max ${MAX_LINES} lines per booking`);
  const all = [...lines.values()];
  return all
    .map(({ v, date, slot }) => ({ venueId: v.id, venueName: v.name, date, slot, rate: rateFor(v, slot, all.filter((l) => l.v === v).length > 1) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const toCart = (items: Pick<Item, "venueId" | "date" | "slot">[]) => items.map((i) => `${i.venueId}_${i.date}_${i.slot}`).join(",");

/** Cart after clicking a slot. A day is Morning, Evening or both: clicks add or drop one slot, the last one drops the line. */
export function toggleSlot(items: Item[], venueId: string, date: string, s: Slot) {
  const line = items.find((i) => i.venueId === venueId && i.date === date);
  const rest = items.filter((i) => i !== line);
  if (line?.slot === s) return toCart(rest);
  const slot: Slot = !line ? s : line.slot === "D" ? (s === "M" ? "E" : "M") : "D";
  return toCart([...rest, { venueId, date, slot }]);
}
