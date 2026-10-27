import Link from "next/link";
import { notFound } from "next/navigation";
import { requestCancel } from "@/app/actions";
import { getBooking } from "@/lib/booking";
import { displayStatus, inr, summary } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Badge, Msg, type SP } from "@/lib/ui";

export default async function CancelBooking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const b = await getBooking(id);
  if (!b || (user.role !== "admin" && b.sectorId !== user.sectorId)) notFound();
  const status = displayStatus(b);
  const mine = user.role === "admin" || b.createdBy === user.uid;

  return (
    <>
      <div className="top"><h1>Cancellation request</h1></div>
      <Msg msg={sp.msg} />
      <div className="grid g2">
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Booking selected</h2>
          <p style={{ margin: 0 }}>
            <b>{b.no}</b> · {summary(b.items)}<br />
            {b.household.name} · HOF {b.household.hof} · {b.household.mobile}<br />
            Amount paid: {inr(b.amount)}{b.receiptNo && ` · Receipt ${b.receiptNo}`}
          </p>
          <div><Badge s={status} /></div>
          {status === "Confirmed" && mine ? (
            <form action={requestCancel} className="stack">
              <input type="hidden" name="id" value={id} />
              <label>Reason<select name="reason">{["Event postponed", "Event cancelled", "Venue change", "Other"].map((r) => <option key={r}>{r}</option>)}</select></label>
              <label>Details<textarea name="details" rows={3} /></label>
              <label className="check"><input type="checkbox" name="informed" required />Household informed that refund follows the trust&apos;s cancellation policy</label>
              <div className="row"><button className="btn primary">Submit cancellation request</button><Link className="btn" href={`/bookings/${id}`}>Back</Link></div>
            </form>
          ) : (
            <p className="note" style={{ margin: 0 }}>
              {status === "Cancellation requested" ? "Request submitted. The venue stays booked until Admin decides." : !mine ? "Only bookings you created can be cancelled from this account." : `A ${status.toLowerCase()} booking can't be cancelled here.`}{" "}
              <Link href={`/bookings/${id}`}>Back to booking</Link>
            </p>
          )}
        </div>
        <div className="card stack">
          <h2 style={{ margin: 0 }}>What happens next</h2>
          <div><Badge s="Cancellation requested" /><p className="muted">The venue stays booked until Admin decides.</p></div>
          <div><Badge s="Cancelled" /><p className="muted">If Admin approves: venue released for all Sectors / Mohallas. Household gets a WhatsApp message. Refund paid by the trust.</p></div>
          <div><Badge s="Confirmed" /><p className="muted">If Admin rejects: booking stays confirmed. You see Admin&apos;s comment.</p></div>
        </div>
      </div>
    </>
  );
}
