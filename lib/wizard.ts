import { priceItems } from "./booking";
import type { Slot, Venue } from "./types";
import { today } from "./format";

/** Booking wizard state, carried in the URL across /book → /book/who → /book/review.
 *  t: D/M/E/X (X = several days), from, to, v: venue ids, h: household, p: purpose, g: guests. */
export type Wizard = { t: string; from: string; to: string; v: string; h?: string; p?: string; g?: string };

export function readWizard(sp: Record<string, string | undefined>): Wizard {
  const t = sp.t ?? "D";
  const from = sp.from || today();
  const to = t === "X" ? sp.to || from : from;
  return { t, from, to, v: sp.v ?? "", ...(sp.h && { h: sp.h }), ...(sp.p && { p: sp.p }), ...(sp.g && { g: sp.g }) };
}

export const qs = (o: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => !!e[1])).toString();

export const slotOf = (w: Wizard): Slot => (w.t === "X" ? "D" : (w.t as Slot));

/** Priced items for the wizard's selection; throws on an invalid range. */
export function wizardItems(w: Wizard, venues: Venue[]) {
  const ids = w.v.split(",").filter(Boolean);
  const selected = venues.filter((v) => v.active && ids.includes(v.id));
  return { selected, items: selected.length ? priceItems(selected, w.from, w.to, slotOf(w)) : [] };
}
