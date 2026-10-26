import type { Item, Slot } from "./types";

const nf = new Intl.NumberFormat("en-IN");
export const inr = (n: number) => `₹ ${nf.format(n)}`;
export const dmy = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "—");
export const dmyhm = (iso?: string) => (iso ? `${dmy(iso)} ${iso.slice(11, 16)}` : "—");
export const SLOT_LABEL: Record<Slot, string> = { M: "Morning", E: "Evening", D: "Full day" };

export function summary(items: Item[]) {
  const venues = [...new Set(items.map((i) => i.venueName))].join(", ");
  const dates = [...new Set(items.map((i) => i.date))].sort();
  const range = dates.length > 1 ? `${dmy(dates[0])} to ${dmy(dates.at(-1))}` : dmy(dates[0]);
  return `${venues} · ${range} · ${SLOT_LABEL[items[0].slot]}${dates.length > 1 ? ` × ${dates.length}` : ""}`;
}

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);
export const today = () => toISODate(new Date());
