import { rows } from "./data";
import { db } from "./firebase-admin";
import { displayStatus } from "./format";
import type { AppUser, Booking, Cancellation } from "./types";

/** The bookings list after its filters (q, from, to, status, sector), newest event first. Shared by the page and its Excel export. */
export async function bookingRows(user: AppUser, sp: Record<string, string | undefined>) {
  // Sector users only ever see their own sector, whatever the URL says.
  const sectorId = user.role === "admin" ? sp.sector : user.sectorId!;
  // shortcut: equality filter + in-memory filter/sort (no composite indexes); fine to a few thousand bookings per sector.
  const scoped = (name: string) => (sectorId ? db.collection(name).where("sectorId", "==", sectorId) : db.collection(name));
  const [all, requests] = await Promise.all([scoped("bookings").get().then(rows<Booking>), scoped("cancellations").get().then(rows<Cancellation>)]);
  requests.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const term = (sp.q ?? "").toLowerCase();
  const list = all
    .map((b) => ({ ...b, shown: displayStatus(b) }))
    .filter((b) => {
      const first = b.items[0].date, last = b.items.at(-1)!.date;
      return (
        (!sp.status || b.shown === sp.status) &&
        (!sp.from || last >= sp.from) &&
        (!sp.to || first <= sp.to) &&
        (!term || `${b.no} ${b.household.name} ${b.household.hof} ${b.items.map((i) => i.venueName).join(" ")}`.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => b.items[0].date.localeCompare(a.items[0].date));
  return { list, requests };
}
