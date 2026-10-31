import { cache } from "react";
import { EN_MONTHS, englishLabel, fromMisri, misri, MISRI_MONTHS, misriLabel } from "./misri";
import { getUser } from "./session";
import type { Booking, Item, Slot } from "./types";

const nf = new Intl.NumberFormat("en-IN");
export const inr = (n: number) => `₹ ${nf.format(n)}`;
/** Timestamps are stored in UTC; shift to IST before reading the date or time. Plain YYYY-MM-DD dates pass through. */
export const ist = (iso: string) => (iso.length > 10 ? new Date(Date.parse(iso) + 5.5 * 3600e3).toISOString() : iso);
export const SLOT_LABEL: Record<Slot, string> = { M: "Morning", E: "Evening", D: "Full day" };

/** Date formatters showing both calendars, `hijri` picks which comes first: "22 Jumada I 1448 (01 Nov 2026)" or "01 Nov 2026 (22 Jumada I 1448)". */
export function formatters(hijri = true) {
  const [one, alt] = hijri ? [misriLabel, englishLabel] : [englishLabel, misriLabel];
  const dmy = (iso?: string) => {
    if (!iso) return "—";
    const d = ist(iso).slice(0, 10);
    return `${one(d)} (${alt(d)})`;
  };
  /** First day (YYYY-MM-DD) of the month `n` months after the one holding `iso`, in this calendar. */
  const monthStart = (iso: string, n = 0) => {
    if (hijri) {
      const h = misri(iso);
      return fromMisri(h.y, h.m + n);
    }
    return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 10);
  };
  /** "Jumada I 1448 (Oct–Nov 2026)" or "November 2026 (Jumada I–Jumada II 1448)": the month, then what it spans in the other calendar. */
  const monthLabel = (start: string) => {
    const last = toISODate(new Date(Date.parse(monthStart(start, 1) + "T00:00:00Z") - 864e5));
    const mon = (d: string) => EN_MONTHS[+d.slice(5, 7) - 1];
    const mi = (d: string) => misri(d);
    if (hijri) {
      const h = mi(start);
      const [y1, y2] = [start.slice(0, 4), last.slice(0, 4)];
      const span = mon(start) === mon(last) ? `${mon(start)} ${y1}` : `${mon(start)}${y1 !== y2 ? ` ${y1}` : ""}–${mon(last)} ${y2}`;
      return `${MISRI_MONTHS[h.m - 1]} ${h.y} (${span})`;
    }
    const en = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
    const [a, b] = [mi(start), mi(last)];
    const span = a.m === b.m ? `${MISRI_MONTHS[a.m - 1]} ${a.y}` : `${MISRI_MONTHS[a.m - 1]}${a.y !== b.y ? ` ${a.y}` : ""}–${MISRI_MONTHS[b.m - 1]} ${b.y}`;
    return `${en(start, { month: "long", year: "numeric" })} (${span})`;
  };
  const dmyhm = (iso?: string) => (iso ? `${dmy(iso)} ${ist(iso).slice(11, 16)}` : "—");
  const summary = (items: Item[]) => {
    const venues = [...new Set(items.map((i) => i.venueName))].join(", ");
    const dates = [...new Set(items.map((i) => i.date))].sort();
    const range = dates.length > 1 ? `${dmy(dates[0])} to ${dmy(dates.at(-1))}` : dmy(dates[0]);
    return `${venues} · ${range} · ${SLOT_LABEL[items[0].slot]}${dates.length > 1 ? ` × ${dates.length}` : ""}`;
  };
  return { hijri, dmy, dmyhm, summary, monthStart, monthLabel };
}
/** Default (Misri first) formatters, for output with no viewer: WhatsApp/SMS, receipts, error messages. */
export const { dmy, dmyhm, summary } = formatters();
/** Formatters for the viewer's calendar choice (users/{uid}.cal, set by the header toggle). Server components only. */
// Kept on the user doc, not a cookie: Firebase's CDN forwards only the `__session` cookie to the app.
export const fmt = cache(async () => formatters((await getUser())?.cal !== "en"));

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

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
