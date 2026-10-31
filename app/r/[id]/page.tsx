import { notFound } from "next/navigation";
import { getBooking } from "@/lib/booking";
import { fmt, inr, SLOT_LABEL } from "@/lib/format";

// Public receipt, linked from WhatsApp and the Razorpay callback. The URL holds the random Firestore doc id
// (not BK-xxxx), so it can't be guessed. Print → Save as PDF gives the file; no PDF lib, no stored file.
export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { dmy, dmyhm } = await fmt();
  const b = await getBooking((await params).id);
  if (!b) notFound();
  if (!b.receiptNo)
    return <main className="login"><div className="card"><h2>Payment processing</h2><p>Booking {b.no}: this page shows the receipt once the payment is confirmed. Refresh in a minute.</p></div></main>;

  return (
    <main className="page-narrow">
      <div className="card">
        <div className="top"><div><h1>Husainin Baug</h1><span className="muted">Hall &amp; Room Booking · Receipt / Invoice{process.env.TRUST_GSTIN && ` · GSTIN ${process.env.TRUST_GSTIN}`}</span></div><b>Invoice {b.receiptNo}</b></div>
        <p>
          Booking <b>{b.no}</b>{b.status === "cancelled" && " (cancelled)"}<br />
          {b.household.name} · HOF {b.household.hof}<br />
          {b.sectorName}
        </p>
        <table>
          <thead><tr><th>Venue</th><th>Date</th><th>Slot</th><th>Amount</th></tr></thead>
          <tbody>
            {b.items.map((i) => <tr key={i.venueId + i.date}><td>{i.venueName}</td><td>{dmy(i.date)}</td><td>{SLOT_LABEL[i.slot]}</td><td>{inr(i.rate)}</td></tr>)}
            <tr><td colSpan={3}><b>Total paid</b></td><td><b>{inr(b.amount)}</b></td></tr>
          </tbody>
        </table>
        <p className="muted">Paid {dmyhm(b.payment?.paidAt)} via {b.payment?.method} (Razorpay {b.payment?.paymentId})</p>
      </div>
    </main>
  );
}
