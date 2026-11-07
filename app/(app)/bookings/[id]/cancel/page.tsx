import { Icon } from "@/lib/icons";
import Link from "next/link";
import { Select } from "@/lib/dropdown";
import { notFound } from "next/navigation";
import { decideCancel, requestCancel } from "@/app/actions";
import { getBooking } from "@/lib/booking";
import { rows } from "@/lib/data";
import { DateField } from "@/lib/date-field";
import { db } from "@/lib/firebase-admin";
import { displayStatus, fmt, inr, today } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Cancellation } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";
import { Submit } from "@/lib/submit";

export default async function CancelBooking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { dmy, summary, hijri } = await fmt();
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const b = await getBooking(id);
  if (!b || (user.role !== "admin" && b.sectorId !== user.sectorId)) notFound();
  const status = displayStatus(b);
  const mine = user.role === "admin" || b.createdBy === user.uid;
  const review = user.role === "admin" ? (await db.collection("cancellations").where("bookingId", "==", id).get().then(rows<Cancellation>)).find((c) => c.status === "awaiting") : undefined;

  return (
    <>
      <div className="top"><h1>Cancellation request</h1></div>
      <Msg msg={sp.msg} />
      <div className="grid g2">
        <div className="card stack">
          <h2 className="m0">Booking selected</h2>
          <p className="m0">
            <b>{b.no}</b> · {summary(b.items)}<br />
            {b.household.name} · HOF {b.household.hof} · {b.household.mobile}<br />
            Amount paid: {inr(b.amount)}{b.receiptNo && ` · Receipt ${b.receiptNo}`}
          </p>
          <div><Badge s={status} /></div>
          {review ? (
            <form action={decideCancel} className="stack">
              <input type="hidden" name="id" value={review.id} />
              <input type="hidden" name="bookingId" value={id} />
              <p className="m0">
                Request {review.no}, by {review.requestedByName}, {b.sectorName} · {dmy(review.requestedAt)}<br />
                Reason: {review.reason}
              </p>
              <label>Admin comment<textarea name="comment" rows={2} /></label>
              <b>Refund (paid manually, recorded here)</b>
              <div className="row">
                <label>Refund amount (₹)<input type="number" name="refundAmount" min={1} max={b.amount} defaultValue={b.amount} /></label>
                <label>Refund date<DateField hijri={hijri} name="refundDate" defaultValue={today()} /></label>
                <Select label="Mode" name="refundMode"><option>Bank transfer</option><option>UPI</option><option>Cheque</option></Select>
                <label>Reference<input name="refundRef" /></label>
              </div>
              <div className="row">
                <Submit className="btn primary btn-icon" name="decision" value="approve"><Icon name="check" />Approve cancellation</Submit>
                <Submit className="btn btn-icon" name="decision" value="reject"><Icon name="x" />Reject</Submit>
              </div>
            </form>
          ) : status === "Confirmed" && mine ? (
            <form action={requestCancel} className="stack">
              <input type="hidden" name="id" value={id} />
              <Select label="Reason" name="reason">{["Event postponed", "Event cancelled", "Venue change", "Other"].map((r) => <option key={r}>{r}</option>)}</Select>
              <label>Details<textarea name="details" rows={3} /></label>
              <label className="check"><input type="checkbox" name="informed" required />Household informed that refund follows the trust&apos;s cancellation policy</label>
              <div className="row"><Submit className="btn primary btn-icon"><Icon name="send" />Submit cancellation request</Submit><Link className="btn btn-icon" href={`/bookings/${id}`}><Icon name="back" />Back</Link></div>
            </form>
          ) : (
            <p className="alert info m0">
              {status === "Cancellation requested" ? "Request submitted. The venue stays booked until Admin decides." : !mine ? "Only bookings you created can be cancelled from this account." : `A ${status.toLowerCase()} booking can't be cancelled here.`}{" "}
              <Link href={`/bookings/${id}`}>Back to booking</Link>
            </p>
          )}
        </div>
        <div className="card stack">
          <h2 className="m0">What happens next</h2>
          <div><Badge s="Cancellation requested" /><p className="muted">The venue stays booked until Admin decides.</p></div>
          <div><Badge s="Cancelled" /><p className="muted">If Admin approves: venue released for all Sectors / Mohallas. Household gets a WhatsApp message. Refund paid by the trust.</p></div>
          <div><Badge s="Confirmed" /><p className="muted">If Admin rejects: booking stays confirmed. You see Admin&apos;s comment.</p></div>
        </div>
      </div>
    </>
  );
}
