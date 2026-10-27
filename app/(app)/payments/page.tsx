import Link from "next/link";
import { getSectors } from "@/lib/data";
import { dmy, dmyhm, inr } from "@/lib/format";
import { paymentRows } from "@/lib/payments";
import { requireAdmin } from "@/lib/session";
import { Badge, type SP } from "@/lib/ui";

export default async function Payments({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const [sectors, { list, refunds }] = await Promise.all([getSectors(), paymentRows(sp)]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <div className="top"><h1>Payment collection details</h1></div>
      <div className="card">
        <h2>Filters</h2>
        <form className="row">
          <label>From date<input type="date" name="from" defaultValue={sp.from} /></label>
          <label>To date<input type="date" name="to" defaultValue={sp.to} /></label>
          <label>Sector / Mohalla<select name="sector" defaultValue={sp.sector}><option value="">All</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={sp.status}><option value="">All</option><option value="paid">Paid</option><option value="pending">Pending link</option><option value="refunded">Refunded</option></select></label>
          <button className="btn">Apply</button>
        </form>
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="muted">Collected</div><div className="stat">{inr(list.filter((b) => b.receiptNo).reduce((s, b) => s + b.amount, 0))}</div></div>
        <div className="card"><div className="muted">Payment links pending</div><div className="stat">{list.filter((b) => b.payStatus === "pending").length}</div></div>
        <div className="card"><div className="muted">Refunds recorded</div><div className="stat">{inr(refunds.reduce((s, c) => s + c.refund!.amount, 0))}</div></div>
      </div>
      <div className="card">
        <div className="top" style={{ marginBottom: 8 }}><h2 style={{ margin: 0 }}>Payment collection</h2><a className="btn" href={`/api/payments/export?${qs}`}>Export to Excel (CSV)</a></div>
        <table>
          <thead><tr><th>Receipt no.</th><th>Booking</th><th>Household</th><th>Sector / Mohalla</th><th>Amount</th><th>Method</th><th>Razorpay ref.</th><th>Paid on</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id}>
                <td>{b.receiptNo ?? "—"}</td>
                <td><Link href={`/bookings/${b.id}`}>{b.no}</Link></td>
                <td>{b.household.name}<div className="muted">HOF {b.household.hof}</div></td>
                <td>{b.sectorName}</td>
                <td>{inr(b.amount)}</td>
                <td>{b.payment?.method ?? "Link sent"}</td>
                <td>{b.payment?.paymentId ?? b.payment?.linkId}</td>
                <td>{dmyhm(b.payment?.paidAt)}</td>
                <td><Badge s={b.payStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Refund register (refunds paid manually, recorded on cancellation approval)</h2>
        <table>
          <thead><tr><th>Booking</th><th>Refund amount</th><th>Refund date</th><th>Mode</th><th>Reference</th><th>Recorded by</th></tr></thead>
          <tbody>
            {refunds.map((c) => (
              <tr key={c.id}><td><Link href={`/bookings/${c.bookingId}`}>{c.bookingNo}</Link></td><td>{inr(c.refund!.amount)}</td><td>{dmy(c.refund!.date)}</td><td>{c.refund!.mode}</td><td>{c.refund!.reference}</td><td>{c.refund!.recordedBy}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="note">Payments are confirmed automatically when Razorpay reports the payment. Online only: UPI, card, net banking.</p>
      </div>
    </>
  );
}
