import { rows } from "./data";
import { db } from "./firebase-admin";
import type { Booking, Cancellation } from "./types";

export type PaymentRow = Booking & { payStatus: "paid" | "pending" | "refunded" };

/** Shared by the Payments page and its CSV export. */
// shortcut: loads all bookings that ever had a payment link and filters in memory. Fine for a few thousand/year;
// beyond that, add a paidAt range query + composite indexes.
export async function paymentRows(f: { from?: string; to?: string; sector?: string; status?: string }) {
  const [bookings, crs] = await Promise.all([
    db.collection("bookings").where("payment.linkId", ">", "").get().then(rows<Booking>),
    db.collection("cancellations").where("status", "==", "approved").get().then(rows<Cancellation>),
  ]);
  const refunded = new Map(crs.filter((c) => c.refund).map((c) => [c.bookingId, c]));
  const list: PaymentRow[] = bookings
    .filter((b) => b.status !== "cancelled" || b.receiptNo) // unpaid releases aren't payments
    .map((b) => ({ ...b, payStatus: refunded.has(b.id) ? "refunded" : b.receiptNo ? "paid" : "pending" }) as PaymentRow)
    .filter((b) => {
      const day = (b.payment?.paidAt ?? b.createdAt).slice(0, 10);
      return (!f.from || day >= f.from) && (!f.to || day <= f.to) && (!f.sector || b.sectorId === f.sector) && (!f.status || b.payStatus === f.status);
    })
    .sort((a, b) => (b.payment?.paidAt ?? b.createdAt).localeCompare(a.payment?.paidAt ?? a.createdAt));
  const refunds = [...refunded.values()].filter((c) => (!f.sector || c.sectorId === f.sector) && (!f.from || c.refund!.date >= f.from) && (!f.to || c.refund!.date <= f.to));
  return { list, refunds };
}
