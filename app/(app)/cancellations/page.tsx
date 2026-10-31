import Link from "next/link";
import { decideCancel } from "@/app/actions";
import { getBooking } from "@/lib/booking";
import { getSectors, rows } from "@/lib/data";
import { db } from "@/lib/firebase-admin";
import { dmy, inr, summary, today } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Booking, Cancellation } from "@/lib/types";
import { Badge, Msg, type SP } from "@/lib/ui";
import { Submit } from "@/lib/submit";

export default async function Cancellations({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const sp = await searchParams;
  if (!isAdmin) sp.sector = user.sectorId!; // sector users see only their own requests, read-only
  const status = sp.status ?? (isAdmin ? "awaiting" : "all");
  const [sectors, all] = await Promise.all([getSectors(), db.collection("cancellations").get().then(rows<Cancellation>)]);
  const crs = all.filter((c) => (status === "all" || c.status === status) && (!sp.sector || c.sectorId === sp.sector)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  // One batched read for all listed bookings (was one read per row).
  const ids = [...new Set(crs.map((c) => c.bookingId))];
  const bookings = new Map(ids.length ? (await db.getAll(...ids.map((id) => db.doc(`bookings/${id}`)))).map((d) => [d.id, { id: d.id, ...d.data() } as Booking] as const) : []);
  const review = isAdmin && all.find((c) => c.id === sp.review && c.status === "awaiting");
  const rb = review && (bookings.get(review.bookingId) ?? (await getBooking(review.bookingId)))!;

  return (
    <>
      <div className="top"><h1>{isAdmin ? "Cancellation approval" : "Cancellations"}</h1></div>
      <Msg msg={sp.msg} />
      <div className="card">
        <form className="row">
          <label>Status<select name="status" defaultValue={status}><option value="awaiting">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label>
          {isAdmin && <label>Sector / Mohalla<select name="sector" defaultValue={sp.sector}><option value="">All</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          <button className="btn">Apply</button>
        </form>
      </div>
      <div className="card">
        <h2>Cancellation requests</h2>
        <table>
          <thead><tr><th>Request</th><th>Booking</th><th>Household</th><th>Sector / Mohalla</th><th>Venue · date · slot</th><th>Amount paid</th><th>Requested by</th><th>Status</th><th>Admin comment</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {crs.map((c) => {
              const b = bookings.get(c.bookingId)!;
              return (
                <tr key={c.id}>
                  <td>{c.no}</td><td><Link href={`/bookings/${b.id}`}>{b.no}</Link></td>
                  <td>{b.household.name}<div className="muted">HOF {b.household.hof}</div></td>
                  <td>{b.sectorName}</td><td>{summary(b.items)}</td><td>{inr(b.amount)}</td><td>{c.requestedByName}</td>
                  <td><Badge s={c.status === "awaiting" ? "Awaiting approval" : c.status} /></td>
                  <td>{c.adminComment ?? "—"}</td>
                  <td>{isAdmin && c.status === "awaiting" && <Link href={`?${new URLSearchParams({ ...(sp as Record<string, string>), review: c.id })}#review`}>Review</Link>}</td>
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
              <label>Refund amount (₹)<input type="number" name="refundAmount" min={1} max={rb.amount} defaultValue={rb.amount} /></label>
              <label>Refund date<input type="date" name="refundDate" defaultValue={today()} /></label>
              <label>Mode<select name="refundMode"><option>Bank transfer</option><option>UPI</option><option>Cheque</option></select></label>
              <label>Reference<input name="refundRef" /></label>
            </div>
            <div className="row">
              <Submit className="btn primary" name="decision" value="approve">Approve cancellation</Submit>
              <Submit className="btn" name="decision" value="reject">Reject</Submit>
            </div>
          </form>
          <p className="alert info">On approval the venues become available to all Sectors / Mohallas and the household gets a WhatsApp message.</p>
        </div>
      )}
    </>
  );
}
