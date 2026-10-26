import { getBooking } from "@/lib/booking";
import { dmy, dmyhm, inr, SLOT_LABEL } from "@/lib/format";
import { textPdf } from "@/lib/pdf";

// Generated on request (also fetched by MSG91 as the WhatsApp attachment). Same unguessable-id access as /r/[id].
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = await getBooking((await params).id);
  if (!b?.receiptNo) return new Response("Not found", { status: 404 });
  const pdf = textPdf([
    { text: "Husainin Baug", size: 18, bold: true, gap: 0 },
    { text: "Hall & Room Booking - Receipt", gap: 20 },
    { text: `Receipt no. ${b.receiptNo}    Booking ${b.no}`, bold: true, gap: 34 },
    { text: `Household: ${b.household.name}  -  HOF ${b.household.hof}  -  ${b.household.mobile}` },
    { text: `Sector / Mohalla: ${b.sectorName}` },
    { text: "Venue                          Date            Slot          Amount", bold: true, gap: 30 },
    ...b.items.map((i) => ({ text: `${i.venueName.padEnd(30)} ${dmy(i.date).padEnd(15)} ${SLOT_LABEL[i.slot].padEnd(13)} ${inr(i.rate)}` })),
    { text: `Total paid: ${inr(b.amount)}`, bold: true, gap: 28 },
    { text: `Paid on ${dmyhm(b.payment?.paidAt)} via ${b.payment?.method?.toUpperCase()} (Razorpay ${b.payment?.paymentId})` },
    { text: "Cancellation is subject to Admin approval and the trust's policy.", size: 9, gap: 34 },
  ]);
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Receipt_${b.receiptNo}.pdf"` } });
}
