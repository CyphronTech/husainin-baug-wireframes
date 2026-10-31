import { b2Enabled, uploadPublic } from "./b2";
import { dmy, dmyhm, inr, SLOT_LABEL } from "./format";
import { textPdf } from "./pdf";
import type { Booking } from "./types";

/** Invoice numbers contain "/" (HB/26-27/0001); file names and storage paths can't. */
export const receiptFile = (b: Booking) => `Invoice_${b.receiptNo!.replace(/\//g, "-")}.pdf`;

export function receiptPdf(b: Booking) {
  return textPdf([
    { text: "Husainin Baug", size: 18, bold: true, gap: 0 },
    { text: `Hall & Room Booking - Receipt / Invoice${process.env.TRUST_GSTIN ? `   GSTIN ${process.env.TRUST_GSTIN}` : ""}`, gap: 20 },
    { text: `Invoice no. ${b.receiptNo}    Booking ${b.no}`, bold: true, gap: 34 },
    { text: `Household: ${b.household.name}  -  HOF ${b.household.hof}  -  ${b.household.mobile}` },
    { text: `Sector / Mohalla: ${b.sectorName}` },
    { text: `${"Venue".padEnd(30)} ${"Date".padEnd(31)} ${"Slot".padEnd(13)} Amount`, bold: true, gap: 30 },
    ...b.items.map((i) => ({ text: `${i.venueName.padEnd(30)} ${dmy(i.date).padEnd(31)} ${SLOT_LABEL[i.slot].padEnd(13)} ${inr(i.rate)}` })),
    { text: `Total paid: ${inr(b.amount)}`, bold: true, gap: 28 },
    { text: `Paid on ${dmyhm(b.payment?.paidAt)} via ${b.payment?.method?.toUpperCase()} (Razorpay ${b.payment?.paymentId})` },
    { text: "Cancellation is subject to Admin approval and the trust's policy.", size: 9, gap: 34 },
  ]);
}

/** Saves the receipt PDF to B2 and returns the link that goes on WhatsApp. Never throws (payment is already done). */
export async function storeReceipt(b: Booking) {
  const fallback = `${process.env.APP_URL}/r/${b.id}/pdf`; // generated live by the app
  if (!b2Enabled()) return fallback;
  try {
    return await uploadPublic(`receipts/${b.id}/${receiptFile(b)}`, receiptPdf(b), "application/pdf");
  } catch (e) {
    console.error("[b2]", e);
    return fallback;
  }
}
