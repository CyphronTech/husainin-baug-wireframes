import Link from "next/link";
import { notFound } from "next/navigation";
import { releaseBooking, requestCancel, retryPaymentLink } from "@/app/actions";
import { getBooking } from "@/lib/booking";
import { rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { dmy, dmyhm, inr, SLOT_LABEL } from "@/lib/format";
import { mockPayments } from "@/lib/razorpay";
import { requireUser } from "@/lib/session";
import type { Cancellation } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const b = await getBooking(id);
  // Household details are scoped to the booking's own Sector / Mohalla — enforced here, not just hidden in the UI.
  if (!b || (user.role !== "admin" && b.sectorId !== user.sectorId)) notFound();
  const canAct = user.role === "admin" || b.createdBy === user.uid;
  const crs = rows<Cancellation>(await db.collection("cancellations").where("bookingId", "==", id).get());
  const awaiting = crs.some((c) => c.status === "awaiting");

  return (
    <>
      <div className="top"><h1>Booking {b.no}</h1><Badge s={b.status} /></div>
      <Msg msg={sp.msg} />
      <div className="grid g2">
        <div className="card">
          <h2>Details</h2>
          <p>
            <b>{b.household.name}</b> · HOF {b.household.hof} · {b.household.mobile}<br />
            {b.sectorName} · created by {b.createdByName} on {dmyhm(b.createdAt)}
          </p>
          <table>
            <thead><tr><th>Venue</th><th>Date</th><th>Slot</th><th>Rate</th></tr></thead>
            <tbody>
              {b.items.map((i) => <tr key={i.venueId + i.date}><td>{i.venueName}</td><td>{dmy(i.date)}</td><td>{SLOT_LABEL[i.slot]}</td><td>{inr(i.rate)}</td></tr>)}
              <tr><td colSpan={3}><b>Total</b></td><td><b>{inr(b.amount)}</b></td></tr>
            </tbody>
          </table>
        </div>

        <div className="card stack">
          <h2>Payment</h2>
          {b.status === "pending" && b.payment && (
            <>
              <p style={{ margin: 0 }}>Share this Razorpay link with the household. The booking confirms automatically once paid.</p>
              <input readOnly value={b.payment.url} />
              {mockPayments && <p className="muted">Mock mode — <a href={b.payment.url}>open mock checkout</a></p>}
            </>
          )}
          {b.status === "pending" && !b.payment && (
            <form action={retryPaymentLink}><input type="hidden" name="id" value={id} /><button className="btn primary">Create payment link</button></form>
          )}
          {b.receiptNo && (
            <p style={{ margin: 0 }}>
              Receipt <b>{b.receiptNo}</b> · {b.payment?.method} · {b.payment?.paymentId}<br />Paid {dmyhm(b.payment?.paidAt)}<br />
              <Link href={`/r/${b.id}`}>View / print receipt</Link>
            </p>
          )}

          {canAct && b.status === "pending" && (
            <form action={releaseBooking}><input type="hidden" name="id" value={id} /><button className="btn danger">Cancel &amp; release slot (unpaid)</button></form>
          )}
          {canAct && b.status === "confirmed" && !awaiting && (
            <form action={requestCancel} className="stack">
              <input type="hidden" name="id" value={id} />
              <label>Cancellation reason<textarea name="reason" required rows={2} /></label>
              <div><button className="btn danger">Request cancellation</button></div>
              <span className="muted">Admin approves cancellations of paid bookings; refunds are paid manually.</span>
            </form>
          )}
          {crs.map((c) => (
            <p key={c.id} className="muted" style={{ margin: 0 }}>{c.no}: <Badge s={c.status} /> {c.reason}{c.adminComment && ` — Admin: ${c.adminComment}`}</p>
          ))}
        </div>
      </div>
    </>
  );
}
