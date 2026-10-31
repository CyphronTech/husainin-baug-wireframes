import { cookies } from "next/headers";
import { cache } from "react";
import type { Booking, Item, Slot } from "./types";

const nf = new Intl.NumberFormat("en-IN");
export const inr = (n: number) => `₹ ${nf.format(n)}`;
/** Timestamps are stored in UTC; shift to IST before reading the date or time. Plain YYYY-MM-DD dates pass through. */
export const ist = (iso: string) => (iso.length > 10 ? new Date(Date.parse(iso) + 5.5 * 3600e3).toISOString() : iso);
export const SLOT_LABEL: Record<Slot, string> = { M: "Morning", E: "Evening", D: "Full day" };

/** Date formatters for one calendar: Misri (Bohri) or English. */
export function formatters(hijri = true) {
  const dmy = (iso?: string) => {
    if (!iso) return "—";
    const d = ist(iso).slice(0, 10);
    if (!hijri) return d.split("-").reverse().join("-");
    const h = misri(d);
    return `${h.d} ${MISRI_MONTHS[h.m - 1]} ${h.y}`;
  };
  const dmyhm = (iso?: string) => (iso ? `${dmy(iso)} ${ist(iso).slice(11, 16)}` : "—");
  const summary = (items: Item[]) => {
    const venues = [...new Set(items.map((i) => i.venueName))].join(", ");
    const dates = [...new Set(items.map((i) => i.date))].sort();
    const range = dates.length > 1 ? `${dmy(dates[0])} to ${dmy(dates.at(-1))}` : dmy(dates[0]);
    return `${venues} · ${range} · ${SLOT_LABEL[items[0].slot]}${dates.length > 1 ? ` × ${dates.length}` : ""}`;
  };
  return { hijri, dmy, dmyhm, summary };
}
/** Default (Misri) formatters, for output with no viewer: WhatsApp/SMS, receipts, error messages. */
export const { dmy, dmyhm, summary } = formatters();
/** Formatters for the viewer's calendar choice (`cal` cookie, set by the header toggle). Server components only. */
export const fmt = cache(async () => formatters((await cookies()).get("cal")?.value !== "en"));

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

/** Dawoodi Bohra (Misri) calendar: tabular Hijri, Thursday epoch, 30-year cycle with these leap years. */
const MISRI_LEAP = [2, 5, 8, 10, 13, 16, 19, 21, 24, 27, 29];
export const MISRI_MONTHS = ["Moharram", "Safar", "Rabi I", "Rabi II", "Jumada I", "Jumada II", "Rajab", "Shabaan", "Ramadaan", "Shawwal", "Zilqad", "Zilhaj"];
export function misri(iso: string) {
  const yLen = (y: number) => (MISRI_LEAP.includes(y % 30) ? 355 : 354);
  let n = Date.parse(iso + "T00:00:00Z") / 864e5 + 492149; // days since 1 Moharram 1 AH (15 Jul 622 Julian)
  let y = 1 + 30 * Math.floor(n / 10631);
  n %= 10631;
  while (n >= yLen(y)) n -= yLen(y++);
  let m = 0;
  for (let len = 30; n >= len; len = m % 2 === 0 || (m === 11 && yLen(y) === 355) ? 30 : 29) n -= len, m++;
  return { y, m: m + 1, d: n + 1 };
}
export const today = () => ist(new Date().toISOString()).slice(0, 10);
/** IST midnight of a YYYY-MM-DD date, as a UTC timestamp (for range queries on stored timestamps). */
export const istMidnight = (date: string) => new Date(`${date}T00:00:00+05:30`).toISOString();

/** Status as users see it: holds lapse, past events complete — derived, not stored. */
export function displayStatus(b: Booking, now = new Date().toISOString()) {
  if (b.status === "cancelled") return b.refundDue ? "Refund due" : "Cancelled";
  if (b.status === "pending") return b.holdUntil < now ? "Expired" : "On hold";
  if (b.cancelRequested) return "Cancellation requested";
  return b.items.at(-1)!.date < ist(now).slice(0, 10) ? "Completed" : "Confirmed";
}
