import Link from "next/link";
import { decideCancel } from "@/app/actions";
import { getBooking } from "@/lib/booking";
import { getSectors, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { dmy, inr, summary, today } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import type { Cancellation } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";

export default async function Cancellations({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status ?? "awaiting";
  const [sectors, all] = await Promise.all([getSectors(), db.collection("cancellations").get().then(rows<Cancellation>)]);
  const crs = all.filter((c) => (status === "all" || c.status === status) && (!sp.sector || c.sectorId === sp.sector)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const bookings = new Map(await Promise.all(crs.map(async (c) => [c.bookingId, (await getBooking(c.bookingId))!] as const)));
  const review = all.find((c) => c.id === sp.review && c.status === "awaiting");
  const rb = review && (bookings.get(review.bookingId) ?? (await getBooking(review.bookingId)))!;

  return (
    <>
      <div className="top"><h1>Cancellation approval</h1></div>
      <Msg msg={sp.msg} />
      <div className="card">
        <form className="row">
          <label>Status<select name="status" defaultValue={status}><option value="awaiting">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label>
          <label>Sector / Mohalla<select name="sector" defaultValue={sp.sector}><option value="">All</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <button className="btn">Apply</button>
        </form>
      </div>
      <div className="card">
        <h2>Cancellation requests</h2>
        <table>
          <thead><tr><th>Request</th><th>Booking</th><th>Household</th><th>Sector / Mohalla</th><th>Venue · date · slot</th><th>Amount paid</th><th>Requested by</th><th>Status</th><th /></tr></thead>
          <tbody>
            {crs.map((c) => {
              const b = bookings.get(c.bookingId)!;
              return (
                <tr key={c.id}>
                  <td>{c.no}</td><td><Link href={`/bookings/${b.id}`}>{b.no}</Link></td>
                  <td>{b.household.name}<div className="muted">HOF {b.household.hof}</div></td>
                  <td>{b.sectorName}</td><td>{summary(b.items)}</td><td>{inr(b.amount)}</td><td>{c.requestedByName}</td>
                  <td><Badge s={c.status === "awaiting" ? "Awaiting approval" : c.status} /></td>
                  <td>{c.status === "awaiting" && <Link href={`?${new URLSearchParams({ ...(sp as Record<string, string>), review: c.id })}#review`}>Review</Link>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {review && rb && (
        <div className="card" id="review">
          <h2>Review request {review.no}</h2>
          <p>
            Booking {rb.no} · {summary(rb.items)}<br />
            Household: {rb.household.name} · HOF {rb.household.hof} · {rb.household.mobile}<br />
            Requested by: {review.requestedByName}, {rb.sectorName} · {dmy(review.requestedAt)}<br />
            Reason: {review.reason}
          </p>
          <form action={decideCancel} className="stack">
            <input type="hidden" name="id" value={review.id} />
            <label>Admin comment<textarea name="comment" rows={2} /></label>
            <b>Refund (paid manually, recorded here)</b>
            <div className="row">
              <label>Refund amount (₹)<input type="number" name="refundAmount" defaultValue={rb.amount} /></label>
              <label>Refund date<input type="date" name="refundDate" defaultValue={today()} /></label>
              <label>Mode<select name="refundMode"><option>Bank transfer</option><option>UPI</option><option>Cheque</option></select></label>
              <label>Reference<input name="refundRef" /></label>
            </div>
            <div className="row">
              <button className="btn primary" name="decision" value="approve">Approve cancellation</button>
              <button className="btn" name="decision" value="reject">Reject</button>
            </div>
          </form>
          <p className="note">On approval the venues become available to all Sectors / Mohallas and the household gets a WhatsApp message.</p>
        </div>
      )}
    </>
  );
}
